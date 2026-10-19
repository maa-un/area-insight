import type { RawDataStore, StatisticRecord, StatisticsSource, StatisticsTable } from "../ports.js";

// 取得する e-Stat の統計表。表と絞り込みは、実際に API で中身を確かめて決めた（2026-10）。
// 調査が新しくなったら（住宅・土地統計調査は 5 年ごと）、ここの statsDataId を差し替える。
export const STATISTICS_TABLES: readonly StatisticsTable[] = [
  {
    // 令和5年住宅・土地統計調査「居住世帯の有無(8区分)別住宅数」。総数（0）と空き家（22）で空き家率を出す。
    // 空き家の内訳: 賃貸・売却用及び二次的住宅を除く空き家（221、いわゆる放置空き家）・賃貸用（222）・売却用（223）・二次的住宅（224）
    id: "0004021421",
    name: "housing_vacancy",
    filters: { cdCat01: "0,22,221,222,223,224" },
  },
  {
    // 平成30年住宅・土地統計調査の同じ表。空き家率の 5 年の増減に使う。
    // 内訳のコードの意味が令和5年と違う（221 二次的住宅・222 賃貸用・223 売却用・224 その他の住宅）ため、総数と空き家だけ取る
    id: "0003355290",
    name: "housing_vacancy_previous",
    filters: { cdCat01: "0,22" },
  },
  {
    // 令和5年住宅・土地統計調査「延べ面積１平方メートル当たり家賃」。民営借家（3）・家賃0円を含まない（2）
    id: "0004021492",
    name: "private_rent_per_sqm",
    filters: { cdCat01: "3", cdCat02: "2" },
  },
  {
    // 社会・人口統計体系（市区町村データ）。住民基本台帳人口（総数）を年ごとに取る
    id: "0000020201",
    name: "resident_population",
    filters: { cdCat01: "A2301" },
  },
];

// 統計表をまとめて取り直し、全体を置き換える。
export async function fetchStatistics(
  source: StatisticsSource,
  store: RawDataStore,
  now: Date,
  tables: readonly StatisticsTable[] = STATISTICS_TABLES,
): Promise<Record<string, number>> {
  const rows: { table: StatisticsTable; record: StatisticRecord }[] = [];
  const counts: Record<string, number> = {};
  for (const table of tables) {
    const records = await source.values(table);
    counts[table.name] = records.length;
    for (const record of records) rows.push({ table, record });
  }
  await store.replaceStatistics(rows, now);
  return counts;
}
