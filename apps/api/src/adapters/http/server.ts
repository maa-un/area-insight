import type { IncomingMessage, ServerResponse } from "node:http";
import { CompareList, Favorites, SavedFilters } from "@area-insight/shared";
import { z } from "zod";
import type { TokenVerifier } from "../../application/ports.js";
import type { PreferencesService } from "../../application/preferences-service.js";
import { DomainError } from "../../domain/errors.js";
import type { UserId } from "../../domain/values.js";
import type { WebhookHeaders, WebhookResult } from "../clerk/webhook.js";

// HTTP の入口。ルーティング・入力の検証・認証・エラーの HTTP ステータスへの変換だけを受け持ち、
// 業務の決まりはユースケース（PreferencesService）とドメインに任せる。

const MAX_BODY_BYTES = 64 * 1024;

export type HttpDeps = {
  tokens: TokenVerifier;
  webhook: { receive(headers: WebhookHeaders, body: string): WebhookResult };
  preferences: PreferencesService;
};

// PUT /api/me/<key> の本文は { <key>: [...] } の形で受ける。形は画面との取り決め（@area-insight/shared）で検証する。
const UpdateBody = {
  favorites: z.object({ favorites: Favorites }),
  compare: z.object({ compare: CompareList }),
  filters: z.object({ filters: SavedFilters }),
};
type UpdateKey = keyof typeof UpdateBody;

class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

export function createHandler(deps: HttpDeps) {
  return async (req: IncomingMessage, res: ServerResponse): Promise<void> => {
    const startedAt = Date.now();
    const path = new URL(req.url ?? "/", "http://localhost").pathname;
    let status = 500;
    try {
      const result = await route(deps, req, path);
      status = result.status;
      send(res, result.status, result.body);
    } catch (error) {
      const known = toHttpError(error);
      status = known?.status ?? 500;
      if (!known) console.error(error);
      send(res, status, { error: known?.message ?? "internal error" });
    } finally {
      // 個人を特定できる情報（ユーザー ID・本文）はログに出さない。
      console.log(JSON.stringify({ method: req.method, path, status, ms: Date.now() - startedAt }));
    }
  };
}

// ドメインの決まりに反した入力は利用者の誤りとして 400 にする。
function toHttpError(error: unknown): HttpError | undefined {
  if (error instanceof HttpError) return error;
  if (error instanceof DomainError) return new HttpError(400, error.message);
  return undefined;
}

type Result = { status: number; body?: unknown };

async function route(deps: HttpDeps, req: IncomingMessage, path: string): Promise<Result> {
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
    return { status: 200, body: await deps.preferences.get(userId) };
  }

  const key = /^\/api\/me\/(favorites|compare|filters)$/.exec(path)?.[1] as UpdateKey | undefined;
  if (key) {
    if (req.method !== "PUT") throw new HttpError(405, "method not allowed");
    const userId = await authenticate(deps, req);
    const json = parseJson(await readBody(req));
    return { status: 200, body: await update(deps, userId, key, json) };
  }

  throw new HttpError(404, "not found");
}

async function update(deps: HttpDeps, userId: UserId, key: UpdateKey, json: unknown) {
  switch (key) {
    case "favorites":
      return deps.preferences.replaceFavorites(
        userId,
        parse(UpdateBody.favorites, json, key).favorites,
      );
    case "compare":
      return deps.preferences.replaceCompare(userId, parse(UpdateBody.compare, json, key).compare);
    case "filters":
      return deps.preferences.replaceFilters(userId, parse(UpdateBody.filters, json, key).filters);
  }
}

function parse<T>(schema: z.ZodType<T>, json: unknown, key: UpdateKey): T {
  const parsed = schema.safeParse(json);
  if (!parsed.success) throw new HttpError(400, `invalid ${key}`);
  return parsed.data;
}

async function authenticate(deps: HttpDeps, req: IncomingMessage): Promise<UserId> {
  const token = /^Bearer (.+)$/.exec(req.headers.authorization ?? "")?.[1];
  if (!token) throw new HttpError(401, "missing bearer token");
  try {
    return await deps.tokens.verify(token);
  } catch {
    throw new HttpError(401, "invalid token");
  }
}

async function handleWebhook(deps: HttpDeps, req: IncomingMessage): Promise<Result> {
  const result = deps.webhook.receive(
    {
      id: header(req, "svix-id"),
      timestamp: header(req, "svix-timestamp"),
      signature: header(req, "svix-signature"),
    },
    await readBody(req),
  );
  if (!result.ok) {
    throw result.reason === "invalid-signature"
      ? new HttpError(401, "invalid signature")
      : new HttpError(400, "invalid event");
  }
  await deps.preferences.handleAccountEvent(result.event);
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
