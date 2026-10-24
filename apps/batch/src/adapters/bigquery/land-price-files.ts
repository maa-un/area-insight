import { BigQuery } from "@google-cloud/bigquery";
import { BigQueryWriter, type TableSpec, writeNdjson } from "./bigquery-writer.js";
import { RAW_LAND_PRICES } from "./raw-rows.js";

// 分割取得の中間ファイル。BigQueryRawStore と同じ列対応を使い、値は加工しない。
export class LandPriceFileWriter {
  constructor(private readonly file: string) {}

  async replace(
    spec: TableSpec,
    rows: Iterable<Record<string, unknown>> | AsyncIterable<Record<string, unknown>>,
  ): Promise<void> {
    if (spec.name !== RAW_LAND_PRICES.name) throw new Error("only land prices can be staged");
    await writeNdjson(this.file, rows);
  }
}

// 全分割が成功した後に、1 回のロードジョブで対象年だけ置き換える。
// sourceUris はワイルドカードを使わず列挙し、分割ファイルの欠落を失敗として扱う。
export async function loadLandPriceFiles(
  projectId: string,
  datasetId: string,
  prefix: string,
  year: number,
  parts: number,
): Promise<void> {
  if (
    !/^gs:\/\/[a-z0-9][a-z0-9._-]+\/[a-zA-Z0-9/_-]+$/.test(prefix) ||
    !Number.isInteger(year) ||
    year < 1900 ||
    year > 2100 ||
    !Number.isInteger(parts) ||
    parts < 1 ||
    parts > 64
  ) {
    throw new Error("invalid land price load arguments");
  }
  await new BigQueryWriter(projectId, datasetId).ensureTable(RAW_LAND_PRICES);
  const client = new BigQuery({ projectId });
  const [job] = await client.createJob({
    configuration: {
      load: {
        sourceUris: Array.from({ length: parts }, (_, part) => `${prefix}/${part}.ndjson`),
        destinationTable: {
          projectId,
          datasetId,
          tableId: `${RAW_LAND_PRICES.name}$${year}0101`,
        },
        sourceFormat: "NEWLINE_DELIMITED_JSON",
        writeDisposition: "WRITE_TRUNCATE",
        schema: { fields: RAW_LAND_PRICES.schema },
      },
    },
  });
  await job.promise();
}
