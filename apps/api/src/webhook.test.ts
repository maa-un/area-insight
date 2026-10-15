import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { verifyClerkWebhook } from "./webhook.js";

const key = Buffer.from("test-signing-key-test-signing-key");
const secret = `whsec_${key.toString("base64")}`;
const now = new Date("2026-10-15T00:00:00Z");
const timestamp = String(Math.floor(now.getTime() / 1000));

function sign(id: string, ts: string, body: string) {
  return `v1,${createHmac("sha256", key).update(`${id}.${ts}.${body}`).digest("base64")}`;
}

describe("verifyClerkWebhook", () => {
  const body = JSON.stringify({ type: "user.deleted", data: { id: "user_1" } });

  it("accepts a valid signature", () => {
    const signature = sign("msg_1", timestamp, body);
    expect(verifyClerkWebhook(secret, { id: "msg_1", timestamp, signature }, body, now)).toBe(true);
  });

  it("accepts when one of several signatures matches", () => {
    const signature = `v1,AAAA ${sign("msg_1", timestamp, body)}`;
    expect(verifyClerkWebhook(secret, { id: "msg_1", timestamp, signature }, body, now)).toBe(true);
  });

  it("rejects a tampered body", () => {
    const signature = sign("msg_1", timestamp, body);
    expect(verifyClerkWebhook(secret, { id: "msg_1", timestamp, signature }, `${body} `, now)).toBe(
      false,
    );
  });

  it("rejects an old timestamp", () => {
    const old = String(Number(timestamp) - 600);
    const signature = sign("msg_1", old, body);
    expect(verifyClerkWebhook(secret, { id: "msg_1", timestamp: old, signature }, body, now)).toBe(
      false,
    );
  });

  it("rejects missing headers", () => {
    expect(verifyClerkWebhook(secret, {}, body, now)).toBe(false);
  });
});
