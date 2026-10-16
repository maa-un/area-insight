import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import type { AccountEvent } from "../../application/ports.js";
import { DomainError } from "../../domain/errors.js";
import { userIdOf } from "../../domain/values.js";

// Clerk の Webhook は Svix 形式で署名される。
// 署名対象は "<svix-id>.<svix-timestamp>.<本文>"、鍵は "whsec_" の後ろを base64 デコードしたもの。
const TOLERANCE_SECONDS = 5 * 60;

export type WebhookHeaders = {
  id?: string | undefined;
  timestamp?: string | undefined;
  signature?: string | undefined;
};

export function verifyClerkWebhook(
  secret: string,
  headers: WebhookHeaders,
  body: string,
  now: Date = new Date(),
): boolean {
  const { id, timestamp, signature } = headers;
  if (!id || !timestamp || !signature) return false;

  const sentAt = Number(timestamp);
  if (!Number.isFinite(sentAt) || Math.abs(now.getTime() / 1000 - sentAt) > TOLERANCE_SECONDS) {
    return false;
  }

  const key = Buffer.from(secret.replace(/^whsec_/, ""), "base64");
  const expected = createHmac("sha256", key).update(`${id}.${timestamp}.${body}`).digest();

  // 鍵の切り替え中は複数の署名が空白区切りで並ぶ。どれか 1 つが一致すればよい。
  return signature.split(" ").some((entry) => {
    const [version, value] = entry.split(",");
    if (version !== "v1" || !value) return false;
    const actual = Buffer.from(value, "base64");
    return actual.length === expected.length && timingSafeEqual(actual, expected);
  });
}

const ClerkEvent = z.looseObject({
  type: z.string(),
  data: z.looseObject({ id: z.string().optional() }),
});

export type WebhookResult =
  | { ok: true; event: AccountEvent }
  | { ok: false; reason: "invalid-signature" | "invalid-event" };

// Clerk の Webhook を受け取り、署名を確かめてから認証サービスに依存しない出来事（AccountEvent）に変換する。
export class ClerkWebhook {
  constructor(
    private readonly secret: string,
    private readonly now: () => Date = () => new Date(),
  ) {}

  receive(headers: WebhookHeaders, body: string): WebhookResult {
    if (!verifyClerkWebhook(this.secret, headers, body, this.now())) {
      return { ok: false, reason: "invalid-signature" };
    }
    let json: unknown;
    try {
      json = JSON.parse(body);
    } catch {
      return { ok: false, reason: "invalid-event" };
    }
    const parsed = ClerkEvent.safeParse(json);
    if (!parsed.success) return { ok: false, reason: "invalid-event" };
    return { ok: true, event: toAccountEvent(parsed.data) };
  }
}

function toAccountEvent(event: z.infer<typeof ClerkEvent>): AccountEvent {
  if (event.type !== "user.deleted" || !event.data.id) return { type: "ignored" };
  try {
    return { type: "account-deleted", userId: userIdOf(event.data.id) };
  } catch (error) {
    if (error instanceof DomainError) return { type: "ignored" };
    throw error;
  }
}
