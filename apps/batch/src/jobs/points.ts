import type { PointRecord, PublicDataSource, RawDataStore, TileCatalog } from "../ports.js";
import type { Quarter } from "../quarters.js";

// 地図のタイルごとに取るジョブ。タイルの数が多いため、一覧（TileCatalog）は陸地を含むものに絞ってある。

// 地価（XPT002）は z 13 で取る（API の下限）。
export const LAND_PRICE_ZOOM = 13;
// 駅ごとの取引（XPT001）は z 11 で取る（API の下限）。
export const STATION_ZOOM = 11;

// 指定した年の地価公示と地価調査を取り直し、その年を置き換える。
export async function fetchLandPrices(
  source: PublicDataSource,
  tiles: TileCatalog,
  store: RawDataStore,
  year: number,
  now: Date,
): Promise<{ landPrice: number; prefectureSurvey: number }> {
  const rows: { classification: "0" | "1"; record: PointRecord }[] = [];
  for (const tile of await tiles.tiles(LAND_PRICE_ZOOM)) {
    for (const classification of ["0", "1"] as const) {
      for (const record of await source.landPrices(tile, year, classification)) {
        rows.push({ classification, record });
      }
    }
  }
  await store.replaceLandPrices(year, rows, now);
  return {
    landPrice: rows.filter((row) => row.classification === "0").length,
    prefectureSurvey: rows.filter((row) => row.classification === "1").length,
  };
}

// 直近の期間（既定は 4 四半期）の駅ごとの取引を取り直し、全体を置き換える。
export async function fetchStationTransactions(
  source: PublicDataSource,
  tiles: TileCatalog,
  store: RawDataStore,
  period: { from: Quarter; to: Quarter },
  now: Date,
): Promise<number> {
  const rows: PointRecord[] = [];
  for (const tile of await tiles.tiles(STATION_ZOOM)) {
    rows.push(...(await source.stationTransactions(tile, period.from, period.to)));
  }
  await store.replaceStationTransactions(period, rows, now);
  return rows.length;
}
