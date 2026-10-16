import { z } from "zod";
import type { StatisticRecord, StatisticsSource, StatisticsTable } from "../../ports.js";
import { type FetcherOptions, RateLimitedFetcher } from "../rate-limited-fetcher.js";

// 政府統計の総合窓口（e-Stat）API のクライアント。統計表の値を加工せずに取得する。
// https://www.e-stat.go.jp/api/api-info/e-stat-manual3-0
// アプリケーション ID は API の仕様で URL のクエリに含めるしかない。URL はログにもエラーにも出さない。
const BASE_URL = "https://api.e-stat.go.jp/rest/3.0/app/json/getStatsData";
const PAGE_SIZE = 100_000; // 1 回で取れる上限

const Value = z.looseObject({
  "@area": z.string(),
  "@time": z.string(),
  "@unit": z.string().optional(),
  $: z.string(),
});

const Response = z.looseObject({
  GET_STATS_DATA: z.looseObject({
    RESULT: z.looseObject({ STATUS: z.number(), ERROR_MSG: z.string().optional() }),
    STATISTICAL_DATA: z
      .looseObject({
        RESULT_INF: z.looseObject({ NEXT_KEY: z.union([z.number(), z.string()]).optional() }),
        DATA_INF: z.looseObject({ VALUE: z.union([Value, z.array(Value)]) }).optional(),
      })
      .optional(),
  }),
});

// STATUS 0 は正常、1 は「該当データなし」（正常扱い）。それ以外は失敗。
const NO_DATA = 1;

export type EStatClientOptions = FetcherOptions & { appId: string };

export class EStatClient implements StatisticsSource {
  private readonly fetcher: RateLimitedFetcher;

  constructor(private readonly options: EStatClientOptions) {
    this.fetcher = new RateLimitedFetcher(options);
  }

  async values(table: StatisticsTable): Promise<StatisticRecord[]> {
    const records: StatisticRecord[] = [];
    let start: string | undefined = "1";
    while (start !== undefined) {
      const params: URLSearchParams = new URLSearchParams({
        appId: this.options.appId,
        statsDataId: table.id,
        metaGetFlg: "N",
        cntGetFlg: "N",
        limit: String(PAGE_SIZE),
        startPosition: start,
        ...table.filters,
      });
      const body: z.infer<typeof Response>["GET_STATS_DATA"] = Response.parse(
        await this.fetcher.getJson(`e-Stat ${table.id}`, `${BASE_URL}?${params}`),
      ).GET_STATS_DATA;

      if (body.RESULT.STATUS === NO_DATA) break;
      if (body.RESULT.STATUS !== 0) {
        throw new Error(
          `e-Stat ${table.id} failed: status ${body.RESULT.STATUS} ${body.RESULT.ERROR_MSG ?? ""}`,
        );
      }
      const value = body.STATISTICAL_DATA?.DATA_INF?.VALUE ?? [];
      for (const row of Array.isArray(value) ? value : [value]) records.push(toRecord(row));

      const next: number | string | undefined = body.STATISTICAL_DATA?.RESULT_INF.NEXT_KEY;
      start = next === undefined ? undefined : String(next);
    }
    return records;
  }
}

// "@cat01" "@cat02" … を分類として集める。
function toRecord(row: z.infer<typeof Value>): StatisticRecord {
  const categories: Record<string, string> = {};
  for (const [key, value] of Object.entries(row)) {
    if (/^@cat\d+$/.test(key) && typeof value === "string") categories[key.slice(1)] = value;
  }
  return {
    areaCode: row["@area"],
    categories,
    time: row["@time"],
    value: row.$,
    unit: row["@unit"] ?? null,
  };
}
