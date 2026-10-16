import { once } from "node:events";
import { createWriteStream } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { BigQuery, type TableField } from "@google-cloud/bigquery";

export type TableSpec = {
  name: string;
  schema: TableField[];
  // 指定した DATE 列で日単位パーティションにする。
  partitionField?: string;
};

// 行を NDJSON にしてロードジョブで書き込む。ストリーミング挿入と違い無料で、
// WRITE_TRUNCATE で同じ範囲を丸ごと置き換えられるため、何度実行しても結果が同じになる。
export class BigQueryWriter {
  private readonly client: BigQuery;

  constructor(
    projectId: string,
    private readonly datasetId: string,
  ) {
    this.client = new BigQuery({ projectId });
  }

  async ensureTable(spec: TableSpec): Promise<void> {
    const table = this.client.dataset(this.datasetId).table(spec.name);
    const [exists] = await table.exists();
    if (exists) return;
    await table.create({
      schema: { fields: spec.schema },
      ...(spec.partitionField
        ? { timePartitioning: { type: "DAY", field: spec.partitionField } }
        : {}),
    });
  }

  // partition を渡すとそのパーティション（YYYYMMDD）だけを置き換える。省略時はテーブル全体を置き換える。
  // rows は一時ファイルへ 1 行ずつ書き足し、読み終えてから 1 回のロードジョブで置き換える。
  // 読む途中で例外になったらロードしないため、取得が途中で失敗しても前回の内容が残る。
  async replace(
    spec: TableSpec,
    rows: Iterable<Record<string, unknown>> | AsyncIterable<Record<string, unknown>>,
    partition?: string,
  ): Promise<void> {
    await this.ensureTable(spec);
    const target = partition ? `${spec.name}$${partition}` : spec.name;
    const dir = await mkdtemp(join(tmpdir(), "area-insight-"));
    const file = join(dir, "rows.ndjson");
    try {
      await writeNdjson(file, rows);
      await this.client
        .dataset(this.datasetId)
        .table(target)
        .load(file, {
          sourceFormat: "NEWLINE_DELIMITED_JSON",
          writeDisposition: "WRITE_TRUNCATE",
          schema: { fields: spec.schema },
        });
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  }
}

// 1 行ずつ書き出す。全行を 1 つの文字列にまとめると、取引価格（1 四半期で約 4 万行）でヒープが足りなくなる。
// rows が AsyncIterable なら、取得しながら書き足せるため、全行を配列に溜めずに済む。
export async function writeNdjson(
  file: string,
  rows: Iterable<Record<string, unknown>> | AsyncIterable<Record<string, unknown>>,
): Promise<void> {
  const out = createWriteStream(file, { encoding: "utf8" });
  try {
    for await (const row of rows) {
      if (!out.write(`${JSON.stringify(row)}\n`)) await once(out, "drain");
    }
    out.end();
    await once(out, "finish");
  } catch (error) {
    out.destroy();
    throw error;
  }
}
