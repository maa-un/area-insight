import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterEach, describe, expect, it } from "vitest";
import { PreferencesService } from "../../application/preferences-service.js";
import { userIdOf } from "../../domain/values.js";
import { MemoryPreferencesRepository } from "../memory/memory-preferences-repository.js";
import { createHandler } from "./server.js";

let server: Server | undefined;

afterEach(() => {
  server?.close();
  server = undefined;
});

const user = userIdOf("user_1");

async function start(options: { webhookOk?: boolean } = {}) {
  const store = new MemoryPreferencesRepository();
  const preferences = new PreferencesService(store);
  const handler = createHandler({
    tokens: {
      verify: async (token) => {
        if (token !== "good-token") throw new Error("bad token");
        return user;
      },
    },
    // 署名の検証と Clerk の形の変換は clerk/webhook.test.ts で確かめる。ここでは結果だけを差し替える。
    webhook: {
      receive: () =>
        options.webhookOk === false
          ? { ok: false, reason: "invalid-signature" }
          : { ok: true, event: { type: "account-deleted", userId: user } },
    },
    preferences,
  });
  server = createServer((req, res) => void handler(req, res));
  await new Promise<void>((resolve) => server?.listen(0, resolve));
  const { port } = server.address() as AddressInfo;
  return { store, url: `http://127.0.0.1:${port}` };
}

const auth = { authorization: "Bearer good-token" };

describe("save API", () => {
  it("answers health checks without authentication", async () => {
    const { url } = await start();
    const res = await fetch(`${url}/healthz`);
    expect(res.status).toBe(200);
  });

  it("rejects requests without a valid token", async () => {
    const { url } = await start();
    expect((await fetch(`${url}/api/me`)).status).toBe(401);
    expect(
      (await fetch(`${url}/api/me`, { headers: { authorization: "Bearer nope" } })).status,
    ).toBe(401);
  });

  it("returns empty data for a new user", async () => {
    const { url } = await start();
    const res = await fetch(`${url}/api/me`, { headers: auth });
    expect(await res.json()).toEqual({ favorites: [], compare: [], filters: [] });
  });

  it("saves favorites for the authenticated user only", async () => {
    const { url, store } = await start();
    const res = await fetch(`${url}/api/me/favorites`, {
      method: "PUT",
      headers: { ...auth, "content-type": "application/json" },
      body: JSON.stringify({ favorites: ["13101", "27100"] }),
    });

    expect(res.status).toBe(200);
    expect(store.snapshots.get(user)?.favorites).toEqual(["13101", "27100"]);
  });

  it("validates the request body", async () => {
    const { url } = await start();
    const res = await fetch(`${url}/api/me/compare`, {
      method: "PUT",
      headers: auth,
      body: JSON.stringify({ compare: ["13101", "13102", "13103", "13104"] }),
    });
    expect(res.status).toBe(400);
  });

  it("deletes user data on a signed user.deleted webhook", async () => {
    const { url, store } = await start();
    await store.save((await store.find(user)).replaceFavorites(["13101"]));
    const res = await fetch(`${url}/api/webhooks/clerk`, {
      method: "POST",
      body: JSON.stringify({ type: "user.deleted", data: { id: "user_1" } }),
    });

    expect(res.status).toBe(204);
    expect(store.snapshots.has(user)).toBe(false);
  });

  it("rejects webhooks with an invalid signature", async () => {
    const { url } = await start({ webhookOk: false });
    const res = await fetch(`${url}/api/webhooks/clerk`, { method: "POST", body: "{}" });
    expect(res.status).toBe(401);
  });

  it("turns a broken domain rule into 400", async () => {
    const { url } = await start();
    // 名前の重複は本文の形としては正しいが、ドメインの決まり（名前は重複しない）に反する
    const filter = { name: "安い順", conditions: { metric: "tradePrice" } };
    const res = await fetch(`${url}/api/me/filters`, {
      method: "PUT",
      headers: auth,
      body: JSON.stringify({ filters: [filter, filter] }),
    });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "filter names must be unique" });
  });

  it("returns 404 for unknown paths and 405 for wrong methods", async () => {
    const { url } = await start();
    expect((await fetch(`${url}/nope`)).status).toBe(404);
    expect((await fetch(`${url}/api/me`, { method: "POST", headers: auth })).status).toBe(405);
  });
});
