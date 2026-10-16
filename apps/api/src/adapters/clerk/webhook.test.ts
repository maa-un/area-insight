import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { ClerkWebhook, verifyClerkWebhook } from "./webhook.js";

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

describe("ClerkWebhook", () => {
  const webhook = new ClerkWebhook(secret, () => now);
  const receive = (body: string) =>
    webhook.receive({ id: "msg_1", timestamp, signature: sign("msg_1", timestamp, body) }, body);

  it("turns user.deleted into an account-deleted event", () => {
    const body = JSON.stringify({ type: "user.deleted", data: { id: "user_1" } });
    expect(receive(body)).toEqual({
      ok: true,
      event: { type: "account-deleted", userId: "user_1" },
    });
  });

  it("ignores other event types", () => {
    const body = JSON.stringify({ type: "user.created", data: { id: "user_1" } });
    expect(receive(body)).toEqual({ ok: true, event: { type: "ignored" } });
  });

  it("reports a bad signature and a malformed body separately", () => {
    expect(webhook.receive({}, "{}")).toEqual({ ok: false, reason: "invalid-signature" });
    expect(receive("not json")).toEqual({ ok: false, reason: "invalid-event" });
  });
});
