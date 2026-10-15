import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";

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

export const ClerkEvent = z.looseObject({
  type: z.string(),
  data: z.looseObject({ id: z.string().optional() }),
});
