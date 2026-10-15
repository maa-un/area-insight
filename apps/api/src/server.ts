import type { IncomingMessage, ServerResponse } from "node:http";
import { CompareList, Favorites, SavedFilters, type UserData } from "@area-insight/shared";
import { z } from "zod";
import type { VerifyToken } from "./auth.js";
import type { UserStore } from "./store.js";
import { ClerkEvent, type WebhookHeaders } from "./webhook.js";

const MAX_BODY_BYTES = 64 * 1024;

export type Deps = {
  verifyToken: VerifyToken;
  verifyWebhook: (headers: WebhookHeaders, body: string) => boolean;
  store: UserStore;
};

// PUT /api/me/<key> の本文は { <key>: [...] } の形で受ける。
const updates = {
  favorites: z.object({ favorites: Favorites }),
  compare: z.object({ compare: CompareList }),
  filters: z.object({ filters: SavedFilters }),
} satisfies Record<keyof UserData, z.ZodType>;

class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

export function createHandler(deps: Deps) {
  return async (req: IncomingMessage, res: ServerResponse): Promise<void> => {
    const startedAt = Date.now();
    const path = new URL(req.url ?? "/", "http://localhost").pathname;
    let status = 500;
    try {
      const result = await route(deps, req, path);
      status = result.status;
      send(res, result.status, result.body);
    } catch (error) {
      status = error instanceof HttpError ? error.status : 500;
      const message = error instanceof HttpError ? error.message : "internal error";
      if (!(error instanceof HttpError)) console.error(error);
      send(res, status, { error: message });
    } finally {
      // 個人を特定できる情報（ユーザー ID・本文）はログに出さない。
      console.log(JSON.stringify({ method: req.method, path, status, ms: Date.now() - startedAt }));
    }
  };
}

type Result = { status: number; body?: unknown };

async function route(deps: Deps, req: IncomingMessage, path: string): Promise<Result> {
  if (path === "/healthz") {
    return { status: 200, body: { status: "ok" } };
  }

  if (path === "/api/webhooks/clerk") {
    if (req.method !== "POST") throw new HttpError(405, "method not allowed");
    return handleWebhook(deps, req);
  }

  if (path === "/api/me") {
    if (req.method !== "GET") throw new HttpError(405, "method not allowed");
    const userId = await authenticate(deps, req);
    return { status: 200, body: await deps.store.get(userId) };
  }

  const key = /^\/api\/me\/(favorites|compare|filters)$/.exec(path)?.[1] as
    | keyof UserData
    | undefined;
  if (key) {
    if (req.method !== "PUT") throw new HttpError(405, "method not allowed");
    const userId = await authenticate(deps, req);
    const parsed = updates[key].safeParse(parseJson(await readBody(req)));
    if (!parsed.success) throw new HttpError(400, `invalid ${key}`);
    return { status: 200, body: await deps.store.update(userId, parsed.data) };
  }

  throw new HttpError(404, "not found");
}

async function authenticate(deps: Deps, req: IncomingMessage): Promise<string> {
  const token = /^Bearer (.+)$/.exec(req.headers.authorization ?? "")?.[1];
  if (!token) throw new HttpError(401, "missing bearer token");
  try {
    return await deps.verifyToken(token);
  } catch {
    throw new HttpError(401, "invalid token");
  }
}

async function handleWebhook(deps: Deps, req: IncomingMessage): Promise<Result> {
  const body = await readBody(req);
  const ok = deps.verifyWebhook(
    {
      id: header(req, "svix-id"),
      timestamp: header(req, "svix-timestamp"),
      signature: header(req, "svix-signature"),
    },
    body,
  );
  if (!ok) throw new HttpError(401, "invalid signature");

  const event = ClerkEvent.safeParse(parseJson(body));
  if (!event.success) throw new HttpError(400, "invalid event");
  // 退会したユーザーの保存内容を消す。それ以外のイベントは受け取るだけ。
  if (event.data.type === "user.deleted" && event.data.data.id) {
    await deps.store.delete(event.data.data.id);
  }
  return { status: 204 };
}

function header(req: IncomingMessage, name: string): string | undefined {
  const value = req.headers[name];
  return Array.isArray(value) ? value[0] : value;
}

async function readBody(req: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    size += (chunk as Buffer).length;
    if (size > MAX_BODY_BYTES) throw new HttpError(413, "body too large");
    chunks.push(chunk as Buffer);
  }
  return Buffer.concat(chunks).toString("utf8");
}

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    throw new HttpError(400, "invalid json");
  }
}

function send(res: ServerResponse, status: number, body?: unknown): void {
  if (body === undefined) {
    res.writeHead(status).end();
    return;
  }
  res
    .writeHead(status, {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    })
    .end(JSON.stringify(body));
}
