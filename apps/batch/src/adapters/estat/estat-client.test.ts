import { describe, expect, it, vi } from "vitest";
import { EStatClient } from "./estat-client.js";

const APP_ID = "secret-app-id-0123456789";
const table = { id: "0004021421", name: "housing_vacancy", filters: { cdCat01: "0,22" } };

function client(fetchFn: typeof fetch) {
  return new EStatClient({
    appId: APP_ID,
    requestIntervalMs: 0,
    fetch: fetchFn,
    sleep: async () => {},
  });
}

const page = (values: unknown, nextKey?: number) =>
  Response.json({
    GET_STATS_DATA: {
      RESULT: { STATUS: 0 },
      STATISTICAL_DATA: {
        RESULT_INF: nextKey === undefined ? {} : { NEXT_KEY: nextKey },
        DATA_INF: { VALUE: values },
      },
    },
  });

describe("EStatClient", () => {
  it("follows NEXT_KEY and keeps values as strings", async () => {
    const fetchFn = vi
      .fn()
      .mockResolvedValueOnce(
        page(
          [{ "@area": "20202", "@cat01": "0", "@time": "2023000000", "@unit": "戸", $: "122510" }],
          2,
        ),
      )
      .mockResolvedValueOnce(
        // 1 件だけのときは配列ではなくオブジェクトで返る
        page({ "@area": "20202", "@cat01": "22", "@time": "2023000000", $: "-" }),
      );

    const records = await client(fetchFn as typeof fetch).values(table);

    expect(records).toEqual([
      {
        areaCode: "20202",
        categories: { cat01: "0" },
        time: "2023000000",
        value: "122510",
        unit: "戸",
      },
      {
        areaCode: "20202",
        categories: { cat01: "22" },
        time: "2023000000",
        value: "-",
        unit: null,
      },
    ]);
    const second = new URL(fetchFn.mock.calls[1]?.[0] as string);
    expect(second.searchParams.get("startPosition")).toBe("2");
    expect(second.searchParams.get("cdCat01")).toBe("0,22");
  });

  it("treats status 1 as no data", async () => {
    const fetchFn = vi.fn(async () =>
      Response.json({ GET_STATS_DATA: { RESULT: { STATUS: 1, ERROR_MSG: "該当データなし" } } }),
    );
    expect(await client(fetchFn as typeof fetch).values(table)).toEqual([]);
  });

  it("never puts the application ID into errors", async () => {
    const httpError = vi.fn(async () => new Response(null, { status: 403 }));
    const networkError = vi.fn(async () => {
      throw new TypeError(`fetch failed for https://api.e-stat.go.jp/?appId=${APP_ID}`);
    });
    const apiError = vi.fn(async () =>
      Response.json({ GET_STATS_DATA: { RESULT: { STATUS: 100, ERROR_MSG: "認証に失敗" } } }),
    );

    for (const fetchFn of [httpError, networkError, apiError]) {
      const error = await client(fetchFn as typeof fetch)
        .values(table)
        .catch((e: unknown) => e);
      expect(error).toBeInstanceOf(Error);
      expect(String((error as Error).message)).not.toContain(APP_ID);
    }
  });
});
