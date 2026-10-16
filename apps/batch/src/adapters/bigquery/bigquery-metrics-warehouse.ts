import { BigQuery } from "@google-cloud/bigquery";
import type { MetricsWarehouse } from "../../ports.js";
import { metricsSql } from "./metrics-sql.js";

// 集計の置き場（MetricsWarehouse）の BigQuery 実装。SQL は metrics-sql.ts にある。
export class BigQueryMetricsWarehouse implements MetricsWarehouse {
  private readonly client: BigQuery;
  private readonly sql: ReturnType<typeof metricsSql>;

  constructor(
    projectId: string,
    datasetId: string,
    private readonly bucket: string,
  ) {
    this.client = new BigQuery({ projectId });
    this.sql = metricsSql(`${projectId}.${datasetId}`);
  }

  async rebuildMetrics(): Promise<void> {
    for (const query of this.sql.rebuild) await this.client.query({ query });
  }

  async exportForWeb(exportId: string): Promise<void> {
    for (const query of this.sql.exports(this.bucket, exportId)) await this.client.query({ query });
  }
}
