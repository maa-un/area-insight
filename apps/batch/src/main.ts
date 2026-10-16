import { parseArgs } from "node:util";
import { BigQueryMetricsWarehouse } from "./adapters/bigquery/bigquery-metrics-warehouse.js";
import { BigQueryRawStore } from "./adapters/bigquery/bigquery-raw-store.js";
import { BigQueryWriter } from "./adapters/bigquery/bigquery-writer.js";
import { EStatClient } from "./adapters/estat/estat-client.js";
import { ReinfolibClient } from "./adapters/reinfolib/reinfolib-client.js";
import { FileTileCatalog } from "./adapters/tiles/file-tile-catalog.js";
import { type Config, loadConfig, requireSecret } from "./config.js";
import { aggregate } from "./jobs/aggregate.js";
import { fetchMunicipalities } from "./jobs/municipalities.js";
import { fetchLandPrices, fetchStations, fetchStationTransactions } from "./jobs/points.js";
import { fetchStatistics } from "./jobs/statistics.js";
import { fetchTransactions } from "./jobs/transactions.js";
import { parseQuarter, recentQuarters } from "./quarters.js";

// Cloud Run Jobs から `node dist/main.js <command>` で起動する。
//   municipalities                     市区町村マスタを取り直す
//   transactions [--recent N]          直近 N 四半期（既定 4）の取引価格を取り直す
//   transactions --quarter 2025Q2 ...  指定した四半期を取り直す（初回取り込み・再取得用）
//   land-prices [--year YYYY]          地価公示・地価調査の地点を取り直す（既定は今年）
//   station-transactions [--recent N]  直近 N 四半期（既定 4）の駅ごとの取引を取り直す
//   stations                           駅の位置・駅名・路線名（年に 1 度の更新）を取り直す
//   statistics                         e-Stat の統計（空き家・家賃・人口）を取り直す
//   aggregate                          指標を作り直し、画面向けのファイルを書き出す
const USAGE =
  "usage: main.js municipalities | transactions [--recent N | --quarter YYYYQn ...] | " +
  "land-prices [--year YYYY] | station-transactions [--recent N] | stations | statistics | aggregate";

// タイル一覧はイメージの tiles/ に同梱する（dist/main.js から見て ../tiles/）。
const TILES_DIR = new URL("../tiles/", import.meta.url);

async function main(argv: string[]): Promise<void> {
  const { positionals, values } = parseArgs({
    args: argv,
    allowPositionals: true,
    options: {
      recent: { type: "string", default: "4" },
      quarter: { type: "string", multiple: true },
      year: { type: "string" },
    },
  });

  // 組み立て（コンポジションルート）。取得元と保存先の実装を決めるのはここだけにする。
  const config = loadConfig();
  const store = new BigQueryRawStore(
    new BigQueryWriter(config.GCP_PROJECT_ID, config.BIGQUERY_DATASET),
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
  values: { recent: string; quarter?: string[]; year?: string },
  { config, store, reinfolib, now }: Context,
): Promise<Record<string, unknown>> {
  switch (command) {
    case "municipalities":
      return { rows: await fetchMunicipalities(reinfolib(), store, now) };
    case "transactions": {
      const quarters = values.quarter?.length
        ? values.quarter.map(parseQuarter)
        : recentQuarters(now, Number(values.recent));
      return {
        rows: Object.fromEntries(await fetchTransactions(reinfolib(), store, quarters, now)),
      };
    }
    case "land-prices": {
      const year = values.year ? Number(values.year) : now.getUTCFullYear();
      const tiles = new FileTileCatalog(TILES_DIR);
      return { year, rows: await fetchLandPrices(reinfolib(), tiles, store, year, now) };
    }
    case "station-transactions": {
      // recentQuarters は新しい順。最も古い四半期から最も新しい四半期までを 1 回で取る。
      const quarters = recentQuarters(now, Number(values.recent));
      const to = quarters[0];
      const from = quarters.at(-1);
      if (!to || !from) throw new Error("--recent must be at least 1");
      const tiles = new FileTileCatalog(TILES_DIR);
      return { rows: await fetchStationTransactions(reinfolib(), tiles, store, { from, to }, now) };
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

main(process.argv.slice(2)).catch((error: unknown) => {
  // エラーの文言には URL や鍵を含めない作りにしている（rate-limited-fetcher.ts）。
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
