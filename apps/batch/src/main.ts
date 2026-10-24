import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { parseArgs } from "node:util";
import { BigQueryMetricsWarehouse } from "./adapters/bigquery/bigquery-metrics-warehouse.js";
import { BigQueryRawStore } from "./adapters/bigquery/bigquery-raw-store.js";
import { BigQueryWriter } from "./adapters/bigquery/bigquery-writer.js";
import { knownLandPricePoints } from "./adapters/bigquery/known-land-price-points.js";
import { LandPriceFileWriter, loadLandPriceFiles } from "./adapters/bigquery/land-price-files.js";
import { EStatClient } from "./adapters/estat/estat-client.js";
import { IpssClient } from "./adapters/ipss/ipss-client.js";
import { ReinfolibClient } from "./adapters/reinfolib/reinfolib-client.js";
import { FileTileCatalog, writeTileCatalog } from "./adapters/tiles/file-tile-catalog.js";
import { KnownPointTileCatalog } from "./adapters/tiles/known-point-tile-catalog.js";
import { PartitionedTileCatalog } from "./adapters/tiles/partitioned-tile-catalog.js";
import { type Config, loadConfig, requireSecret } from "./config.js";
import { aggregate } from "./jobs/aggregate.js";
import { fetchMunicipalities } from "./jobs/municipalities.js";
import {
  fetchCondoTransactions,
  fetchLandPrices,
  fetchStations,
  fetchStationTransactions,
} from "./jobs/points.js";
import { fetchProjections } from "./jobs/projections.js";
import { fetchStatistics } from "./jobs/statistics.js";
import { fetchTransactions } from "./jobs/transactions.js";
import { parseQuarter, type Quarter, recentQuarters } from "./quarters.js";

// GitHub Actions / ローカルから `node dist/main.js <command>` で起動する。
//   municipalities                     市区町村マスタを取り直す
//   transactions [--recent N]          直近 N 四半期（既定 4）の取引価格を取り直す
//   transactions --quarter 2025Q2 ...  指定した四半期を取り直す（初回取り込み・再取得用）
//   land-prices [--year YYYY] [--all-tiles]
//                                      地価公示・地価調査の地点を取り直す（既定は今年）。これまでに地点のあった
//                                      タイルだけを取る。--all-tiles で全国の陸地タイルを取る（初回・数年に 1 回）
//   station-transactions [--recent N]  直近 N 四半期（既定 8）の駅ごとの取引（土地、土地と建物）を取り直す。
//                                      駅ごとの取引相場は直近 4 四半期、土地の坪単価は 8 四半期を使う
//   condo-transactions [--recent N]    直近 N 四半期（既定 20 = 5 年）のマンションの取引（中古マンション等。
//                                      取引価格と成約価格）を取り直す。成約事例の地図に使う
//   stations                           駅の位置・駅名・路線名（年に 1 度の更新）を取り直す
//   statistics                         e-Stat の統計（空き家・家賃・人口）を取り直す
//   projections                        社人研の将来推計人口（2050 年まで）を取り直す（推計は約 5 年ごと）
//   aggregate                          指標を作り直し、画面向けのファイルを書き出す
const USAGE =
  "usage: main.js municipalities | transactions [--recent N | --quarter YYYYQn ...] | " +
  "land-prices [--year YYYY] [--all-tiles] [--part N --parts N --output FILE --tiles-directory DIR] | station-transactions [--recent N] | condo-transactions [--recent N] | stations | " +
  "statistics | projections | aggregate | " +
  "prepare-land-price-tiles --output FILE [--all-tiles] | " +
  "load-land-prices --year YYYY --parts N --source-prefix gs://bucket/path";

// 既定で取り直す四半期の数。取引価格は直近 4 四半期の指標に使う（それより前は取り込み済みのものを使う）。
// 駅ごとの取引は全体を置き換えるため、土地の坪単価に使う 8 四半期分を毎回取る。
const TRANSACTION_QUARTERS = 4;
const STATION_TRANSACTION_QUARTERS = 8;
// マンションの成約事例は、仕入れ値の参考に過去 5 年分を見られるようにする。
const CONDO_TRANSACTION_QUARTERS = 20;

// タイル一覧は apps/batch/tiles/ に置く（dist/main.js から見て ../tiles/）。
const TILES_DIR = new URL("../tiles/", import.meta.url);

async function main(argv: string[]): Promise<void> {
  const { positionals, values } = parseArgs({
    args: argv,
    allowPositionals: true,
    options: {
      recent: { type: "string" },
      quarter: { type: "string", multiple: true },
      year: { type: "string" },
      "all-tiles": { type: "boolean", default: false },
      part: { type: "string" },
      parts: { type: "string" },
      output: { type: "string" },
      "source-prefix": { type: "string" },
      "tiles-directory": { type: "string" },
    },
  });

  // 組み立て（コンポジションルート）。取得元と保存先の実装を決めるのはここだけにする。
  const config = loadConfig();
  if (
    values.output &&
    !["land-prices", "prepare-land-price-tiles"].includes(positionals[0] ?? "")
  ) {
    throw new Error("--output is only supported for land-prices and prepare-land-price-tiles");
  }
  if (values.part !== undefined && (!values.output || !values["all-tiles"] || !values.parts)) {
    throw new Error("--part requires --output, --all-tiles and --parts");
  }
  if (values.output && positionals[0] === "land-prices" && values.part === undefined) {
    throw new Error("--output requires --part");
  }
  const store = new BigQueryRawStore(
    values.output
      ? new LandPriceFileWriter(values.output)
      : new BigQueryWriter(config.GCP_PROJECT_ID, config.BIGQUERY_DATASET),
  );
  const reinfolib = () =>
    new ReinfolibClient({
      apiKey: requireSecret(config, "REINFOLIB_API_KEY"),
      requestIntervalMs: config.REQUEST_INTERVAL_MS,
    });
  const now = new Date();

  const result = await run(positionals[0], values, { config, store, reinfolib, now });
  console.log(JSON.stringify({ job: positionals[0], ...result }));
}

type Context = {
  config: Config;
  store: BigQueryRawStore;
  reinfolib: () => ReinfolibClient;
  now: Date;
};

async function run(
  command: string | undefined,
  values: {
    recent?: string;
    quarter?: string[];
    year?: string;
    "all-tiles": boolean;
    part?: string;
    parts?: string;
    output?: string;
    "source-prefix"?: string;
    "tiles-directory"?: string;
  },
  { config, store, reinfolib, now }: Context,
): Promise<Record<string, unknown>> {
  switch (command) {
    case "municipalities":
      return { rows: await fetchMunicipalities(reinfolib(), store, now) };
    case "transactions": {
      const quarters = values.quarter?.length
        ? values.quarter.map(parseQuarter)
        : recentQuarters(now, Number(values.recent ?? TRANSACTION_QUARTERS));
      return {
        rows: Object.fromEntries(await fetchTransactions(reinfolib(), store, quarters, now)),
      };
    }
    case "prepare-land-price-tiles": {
      if (!values.output) throw new Error("prepare-land-price-tiles requires --output");
      const allTiles = new FileTileCatalog(TILES_DIR);
      const catalog = values["all-tiles"]
        ? allTiles
        : new KnownPointTileCatalog(
            knownLandPricePoints(config.GCP_PROJECT_ID, config.BIGQUERY_DATASET),
            allTiles,
          );
      return { tiles: await writeTileCatalog(catalog, 13, values.output) };
    }
    case "land-prices": {
      const year = values.year ? Number(values.year) : now.getUTCFullYear();
      if (!Number.isInteger(year) || year < 1900 || year > 2100) throw new Error("invalid year");
      const fixedTiles = new FileTileCatalog(
        values["tiles-directory"]
          ? pathToFileURL(`${resolve(values["tiles-directory"])}/`)
          : TILES_DIR,
      );
      const allTiles =
        values.part === undefined
          ? fixedTiles
          : new PartitionedTileCatalog(fixedTiles, Number(values.part), Number(values.parts));
      const tiles = values["all-tiles"]
        ? allTiles
        : new KnownPointTileCatalog(
            knownLandPricePoints(config.GCP_PROJECT_ID, config.BIGQUERY_DATASET),
            allTiles,
          );
      return { year, rows: await fetchLandPrices(reinfolib(), tiles, store, year, now) };
    }
    case "load-land-prices": {
      if (!values.year || !values.parts || !values["source-prefix"]) {
        throw new Error("load-land-prices requires --year, --parts and --source-prefix");
      }
      await loadLandPriceFiles(
        config.GCP_PROJECT_ID,
        config.BIGQUERY_DATASET,
        values["source-prefix"],
        Number(values.year),
        Number(values.parts),
      );
      return { year: Number(values.year), parts: Number(values.parts) };
    }
    case "station-transactions": {
      const period = recentPeriod(now, Number(values.recent ?? STATION_TRANSACTION_QUARTERS));
      const tiles = new FileTileCatalog(TILES_DIR);
      return { rows: await fetchStationTransactions(reinfolib(), tiles, store, period, now) };
    }
    case "condo-transactions": {
      const period = recentPeriod(now, Number(values.recent ?? CONDO_TRANSACTION_QUARTERS));
      const tiles = new FileTileCatalog(TILES_DIR);
      return { rows: await fetchCondoTransactions(reinfolib(), tiles, store, period, now) };
    }
    case "stations": {
      const tiles = new FileTileCatalog(TILES_DIR);
      return { rows: await fetchStations(reinfolib(), tiles, store, now) };
    }
    case "statistics": {
      const source = new EStatClient({
        appId: requireSecret(config, "ESTAT_APP_ID"),
        requestIntervalMs: config.REQUEST_INTERVAL_MS,
      });
      return { rows: await fetchStatistics(source, store, now) };
    }
    case "projections": {
      const source = new IpssClient({ requestIntervalMs: config.REQUEST_INTERVAL_MS });
      return { rows: await fetchProjections(source, store, now) };
    }
    case "aggregate": {
      const warehouse = new BigQueryMetricsWarehouse(
        config.GCP_PROJECT_ID,
        config.BIGQUERY_DATASET,
        requireSecret(config, "DATA_BUCKET"),
      );
      return { exportId: await aggregate(warehouse, now) };
    }
    default:
      throw new Error(USAGE);
  }
}

// recentQuarters は新しい順。最も古い四半期から最も新しい四半期までを 1 回で取る。
function recentPeriod(now: Date, count: number): { from: Quarter; to: Quarter } {
  const quarters = recentQuarters(now, count);
  const to = quarters[0];
  const from = quarters.at(-1);
  if (!to || !from) throw new Error("--recent must be at least 1");
  return { from, to };
}

main(process.argv.slice(2)).catch((error: unknown) => {
  // エラーの文言には URL や鍵を含めない作りにしている（rate-limited-fetcher.ts）。
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
