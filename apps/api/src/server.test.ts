import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterEach, describe, expect, it } from "vitest";
import { createHandler } from "./server.js";
import { MemoryUserStore } from "./store.js";

let server: Server | undefined;

afterEach(() => {
  server?.close();
  server = undefined;
});

async function start(options: { webhookOk?: boolean } = {}) {
  const store = new MemoryUserStore();
  const handler = createHandler({
    verifyToken: async (token) => {
      if (token !== "good-token") throw new Error("bad token");
      return "user_1";
    },
    verifyWebhook: () => options.webhookOk ?? true,
    store,
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
    expect((await store.get("user_1")).favorites).toEqual(["13101", "27100"]);
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
    await store.update("user_1", { favorites: ["13101"] });
    const res = await fetch(`${url}/api/webhooks/clerk`, {
      method: "POST",
      body: JSON.stringify({ type: "user.deleted", data: { id: "user_1" } }),
    });

    expect(res.status).toBe(204);
    expect(store.users.has("user_1")).toBe(false);
  });

  it("rejects webhooks with an invalid signature", async () => {
    const { url } = await start({ webhookOk: false });
    const res = await fetch(`${url}/api/webhooks/clerk`, { method: "POST", body: "{}" });
    expect(res.status).toBe(401);
  });

  it("returns 404 for unknown paths and 405 for wrong methods", async () => {
    const { url } = await start();
    expect((await fetch(`${url}/nope`)).status).toBe(404);
    expect((await fetch(`${url}/api/me`, { method: "POST", headers: auth })).status).toBe(405);
  });
});
