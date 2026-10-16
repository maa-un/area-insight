import type {
  PointRecord,
  PublicDataSource,
  RawDataStore,
  StationRecord,
  TileCatalog,
} from "../ports.js";
import type { Quarter } from "../quarters.js";

// 地図のタイルごとに取るジョブ。タイルの数が多いため、一覧（TileCatalog）は陸地を含むものに絞ってある。

// 地価（XPT002）は z 13 で取る（API の下限）。
export const LAND_PRICE_ZOOM = 13;
// 駅ごとの取引（XPT001）と駅（XKT015）は z 11 で取る（API の下限）。
export const STATION_ZOOM = 11;

// 指定した年の地価公示と地価調査を取り直し、その年を置き換える。
// タイルは全国で数千枚あるため、取った分から保存先へ渡し、メモリにはタイル 1 枚分だけを持つ。
export async function fetchLandPrices(
  source: PublicDataSource,
  tiles: TileCatalog,
  store: RawDataStore,
  year: number,
  now: Date,
): Promise<{ landPrice: number; prefectureSurvey: number }> {
  const counts = { landPrice: 0, prefectureSurvey: 0 };
  async function* rows(): AsyncGenerator<{ classification: "0" | "1"; record: PointRecord }> {
    for (const tile of await tiles.tiles(LAND_PRICE_ZOOM)) {
      for (const classification of ["0", "1"] as const) {
        for (const record of await source.landPrices(tile, year, classification)) {
          counts[classification === "0" ? "landPrice" : "prefectureSurvey"] += 1;
          yield { classification, record };
        }
      }
    }
  }
  await store.replaceLandPrices(year, rows(), now);
  return counts;
}

// 直近の期間の駅ごとの取引を取り直し、全体を置き換える。地価と同じく、タイル 1 枚分ずつ保存先へ渡す。
export async function fetchStationTransactions(
  source: PublicDataSource,
  tiles: TileCatalog,
  store: RawDataStore,
  period: { from: Quarter; to: Quarter },
  now: Date,
): Promise<number> {
  let count = 0;
  async function* rows(): AsyncGenerator<PointRecord> {
    for (const tile of await tiles.tiles(STATION_ZOOM)) {
      for (const record of await source.stationTransactions(tile, period.from, period.to)) {
        count += 1;
        yield record;
      }
    }
  }
  await store.replaceStationTransactions(period, rows(), now);
  return count;
}

// 指定した期間のマンションの取引（中古マンション等）を取り直し、全体を置き換える。
// 期間を 1 回のリクエストで取るため、リクエスト数は期間の長さによらずタイルの数で決まる。
export async function fetchCondoTransactions(
  source: PublicDataSource,
  tiles: TileCatalog,
  store: RawDataStore,
  period: { from: Quarter; to: Quarter },
  now: Date,
): Promise<number> {
  let count = 0;
  async function* rows(): AsyncGenerator<PointRecord> {
    for (const tile of await tiles.tiles(STATION_ZOOM)) {
      for (const record of await source.condoTransactions(tile, period.from, period.to)) {
        count += 1;
        yield record;
      }
    }
  }
  await store.replaceCondoTransactions(period, rows(), now);
  return count;
}

// 駅の位置・駅名・路線名を取り直し、全体を置き換える。集計で XPT001 の点に最寄りの駅名を付けるために使う。
// タイルの境目をまたぐ駅は両方のタイルで返るが、加工せずそのまま保存し、重複は集計で吸収する。
export async function fetchStations(
  source: PublicDataSource,
  tiles: TileCatalog,
  store: RawDataStore,
  now: Date,
): Promise<number> {
  let count = 0;
  async function* rows(): AsyncGenerator<StationRecord> {
    for (const tile of await tiles.tiles(STATION_ZOOM)) {
      for (const record of await source.stations(tile)) {
        count += 1;
        yield record;
      }
    }
  }
  await store.replaceStations(rows(), now);
  return count;
}
