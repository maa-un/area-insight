import type { MunicipalityRecord, RawDataStore, TransactionRecord } from "../../ports.js";
import { type Quarter, quarterStartDate } from "../../quarters.js";
import type { BigQueryWriter } from "./bigquery-writer.js";
import {
  municipalityRow,
  RAW_MUNICIPALITIES,
  RAW_TRANSACTIONS,
  transactionRow,
} from "./raw-rows.js";

// 保存先（RawDataStore）の BigQuery 実装。
export class BigQueryRawStore implements RawDataStore {
  constructor(private readonly writer: Pick<BigQueryWriter, "replace">) {}

  async replaceMunicipalities(
    rows: readonly { prefectureCode: string; record: MunicipalityRecord }[],
    fetchedAt: Date,
  ): Promise<void> {
    await this.writer.replace(
      RAW_MUNICIPALITIES,
      rows.map((row) => municipalityRow(row.record, row.prefectureCode, fetchedAt)),
    );
  }

  // 取り直した四半期のパーティション（YYYYMMDD）だけを置き換え、同じ取引が二重に入らないようにする。
  async replaceTransactions(
    quarter: Quarter,
    rows: readonly { prefectureCode: string; record: TransactionRecord }[],
    fetchedAt: Date,
  ): Promise<void> {
    await this.writer.replace(
      RAW_TRANSACTIONS,
      rows.map((row) => transactionRow(row.record, quarter, row.prefectureCode, fetchedAt)),
      quarterStartDate(quarter).replaceAll("-", ""),
    );
  }
}
