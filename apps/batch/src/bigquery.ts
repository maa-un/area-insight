import { mkdtemp, rm, writeFile } from "node:fs/promises";
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
  async replace(
    spec: TableSpec,
    rows: Record<string, unknown>[],
    partition?: string,
  ): Promise<void> {
    await this.ensureTable(spec);
    const target = partition ? `${spec.name}$${partition}` : spec.name;
    const dir = await mkdtemp(join(tmpdir(), "area-insight-"));
    const file = join(dir, "rows.ndjson");
    try {
      await writeFile(file, rows.map((row) => JSON.stringify(row)).join("\n"));
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
