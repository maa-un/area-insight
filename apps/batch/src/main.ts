import { parseArgs } from "node:util";
import { BigQueryWriter } from "./bigquery.js";
import { loadConfig } from "./config.js";
import { fetchMunicipalities } from "./jobs/municipalities.js";
import { fetchTransactions } from "./jobs/transactions.js";
import { parseQuarter, recentQuarters } from "./quarters.js";
import { ReinfolibClient } from "./reinfolib.js";

// Cloud Run Jobs から `node dist/main.js <command>` で起動する。
//   municipalities                     市区町村マスタを取り直す
//   transactions [--recent N]          直近 N 四半期（既定 4）の取引価格を取り直す
//   transactions --quarter 2025Q2 ...  指定した四半期を取り直す（初回取り込み・再取得用）
const USAGE = "usage: main.js municipalities | transactions [--recent N | --quarter YYYYQn ...]";

async function main(argv: string[]): Promise<void> {
  const { positionals, values } = parseArgs({
    args: argv,
    allowPositionals: true,
    options: {
      recent: { type: "string", default: "4" },
      quarter: { type: "string", multiple: true },
    },
  });

  const config = loadConfig();
  const client = new ReinfolibClient({
    apiKey: config.REINFOLIB_API_KEY,
    requestIntervalMs: config.REQUEST_INTERVAL_MS,
  });
  const writer = new BigQueryWriter(config.GCP_PROJECT_ID, config.BIGQUERY_DATASET);
  const now = new Date();

  switch (positionals[0]) {
    case "municipalities": {
      const count = await fetchMunicipalities(client, writer, now);
      console.log(JSON.stringify({ job: "municipalities", rows: count }));
      return;
    }
    case "transactions": {
      const quarters = values.quarter?.length
        ? values.quarter.map(parseQuarter)
        : recentQuarters(now, Number(values.recent));
      const counts = await fetchTransactions(client, writer, quarters, now);
      console.log(JSON.stringify({ job: "transactions", rows: Object.fromEntries(counts) }));
      return;
    }
    default:
      throw new Error(USAGE);
  }
}

main(process.argv.slice(2)).catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
