import { describe, expect, it, vi } from "vitest";
import { ReinfolibClient } from "./reinfolib-client.js";

const noSleep = async () => {};

function client(fetchFn: typeof fetch) {
  return new ReinfolibClient({
    apiKey: "test-key",
    requestIntervalMs: 0,
    fetch: fetchFn,
    sleep: noSleep,
  });
}

describe("ReinfolibClient", () => {
  it("sends the API key header and parses municipalities", async () => {
    const fetchFn = vi.fn(async () =>
      Response.json({ status: "OK", data: [{ id: "13101", name: "千代田区" }] }),
    );
    const result = await client(fetchFn as typeof fetch).municipalities("13");

    expect(result).toEqual([{ code: "13101", name: "千代田区" }]);
    const [url, init] = fetchFn.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toContain("/XIT002?area=13");
    expect(init.headers).toEqual({ "Ocp-Apim-Subscription-Key": "test-key" });
  });

  it("treats 404 as no data", async () => {
    const fetchFn = vi.fn(async () => new Response(null, { status: 404 }));
    expect(
      await client(fetchFn as typeof fetch).transactions("13", { year: 2025, quarter: 1 }),
    ).toEqual([]);
  });

  it("retries server errors and then succeeds", async () => {
    const fetchFn = vi
      .fn()
      .mockResolvedValueOnce(new Response(null, { status: 503 }))
      .mockResolvedValueOnce(
        Response.json({ data: [{ Type: "宅地(土地と建物)", TradePrice: "12000000" }] }),
      );
    const rows = await client(fetchFn as typeof fetch).transactions("13", {
      year: 2025,
      quarter: 1,
    });

    expect(fetchFn).toHaveBeenCalledTimes(2);
    expect(rows[0]?.TradePrice).toBe("12000000");
  });

  it("fails on client errors without retrying", async () => {
    const fetchFn = vi.fn(async () => new Response(null, { status: 401 }));
    await expect(client(fetchFn as typeof fetch).municipalities("13")).rejects.toThrow("HTTP 401");
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it("rejects responses that do not match the expected shape", async () => {
    const fetchFn = vi.fn(async () => Response.json({ data: [{ id: 13101 }] }));
    await expect(client(fetchFn as typeof fetch).municipalities("13")).rejects.toThrow();
  });
});
