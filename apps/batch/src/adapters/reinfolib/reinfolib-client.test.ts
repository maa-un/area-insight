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

  it("reads land price points from GeoJSON and keeps their properties", async () => {
    const fetchFn = vi.fn(async () =>
      Response.json({
        type: "FeatureCollection",
        features: [
          {
            type: "Feature",
            geometry: { type: "Point", coordinates: [137.97, 36.23] },
            properties: { point_id: "p1", u_current_years_price_ja: "88,300(円/㎡)" },
          },
        ],
      }),
    );
    const points = await client(fetchFn as typeof fetch).landPrices(
      { z: 13, x: 7210, y: 3200 },
      2026,
      "0",
    );

    expect(points).toEqual([
      {
        coordinates: [137.97, 36.23],
        properties: { point_id: "p1", u_current_years_price_ja: "88,300(円/㎡)" },
      },
    ]);
    const url = new URL((fetchFn.mock.calls as unknown as [string][])[0]?.[0] ?? "");
    expect(url.pathname).toMatch(/XPT002$/);
    expect(Object.fromEntries(url.searchParams)).toMatchObject({
      z: "13",
      x: "7210",
      y: "3200",
      year: "2026",
      priceClassification: "0",
      response_format: "geojson",
    });
  });

  it("treats an empty array as a tile without data", async () => {
    const fetchFn = vi.fn(async () => Response.json([]));
    const quarter = { year: 2026, quarter: 1 } as const;
    expect(
      await client(fetchFn as typeof fetch).stationTransactions(
        { z: 11, x: 1, y: 1 },
        quarter,
        quarter,
      ),
    ).toEqual([]);
    const url = new URL((fetchFn.mock.calls as unknown as [string][])[0]?.[0] ?? "");
    expect(url.searchParams.get("from")).toBe("20261");
    expect(url.searchParams.get("landTypeCode")).toBe("01,02");
  });

  it("reads stations as lines and keeps their geometry and properties", async () => {
    const geometry = {
      type: "LineString",
      coordinates: [
        [139.7, 35.69],
        [139.701, 35.691],
      ],
    };
    const fetchFn = vi.fn(async () =>
      Response.json({
        type: "FeatureCollection",
        features: [
          {
            type: "Feature",
            geometry,
            properties: { S12_001_ja: "新宿三丁目", S12_001g: "003689" },
          },
        ],
      }),
    );
    const stations = await client(fetchFn as typeof fetch).stations({ z: 11, x: 1818, y: 806 });

    expect(stations).toEqual([
      { geometry, properties: { S12_001_ja: "新宿三丁目", S12_001g: "003689" } },
    ]);
    const url = new URL((fetchFn.mock.calls as unknown as [string][])[0]?.[0] ?? "");
    expect(url.pathname).toMatch(/XKT015$/);
    expect(Object.fromEntries(url.searchParams)).toEqual({
      response_format: "geojson",
      z: "11",
      x: "1818",
      y: "806",
    });
  });
});
