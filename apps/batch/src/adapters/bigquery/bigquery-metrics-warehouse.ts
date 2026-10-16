import { BigQuery } from "@google-cloud/bigquery";
import type { MetricsWarehouse } from "../../ports.js";
import { BigQueryWriter } from "./bigquery-writer.js";
import { metricsSql } from "./metrics-sql.js";
import { RAW_STATIONS } from "./raw-rows.js";

// 集計の置き場（MetricsWarehouse）の BigQuery 実装。SQL は metrics-sql.ts にある。
export class BigQueryMetricsWarehouse implements MetricsWarehouse {
  private readonly client: BigQuery;
  private readonly sql: ReturnType<typeof metricsSql>;
  private readonly writer: BigQueryWriter;

  constructor(
    projectId: string,
    datasetId: string,
    private readonly bucket: string,
  ) {
    this.client = new BigQuery({ projectId });
    this.sql = metricsSql(`${projectId}.${datasetId}`);
    this.writer = new BigQueryWriter(projectId, datasetId);
  }

  async rebuildMetrics(): Promise<void> {
    // 駅（stations ジョブ）を一度も取っていなくても集計が止まらないよう、空のテーブルを用意しておく。
    // その間は駅名が空のまま書き出される
    await this.writer.ensureTable(RAW_STATIONS);
    for (const query of this.sql.rebuild) await this.client.query({ query });
  }

  async exportForWeb(exportId: string): Promise<void> {
    for (const query of this.sql.exports(this.bucket, exportId)) await this.client.query({ query });
  }
}
