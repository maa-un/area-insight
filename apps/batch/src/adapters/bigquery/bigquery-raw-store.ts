import type {
  MunicipalityRecord,
  PointRecord,
  ProjectionRecord,
  RawDataStore,
  StationRecord,
  StatisticRecord,
  StatisticsTable,
  TransactionRecord,
} from "../../ports.js";
import { type Quarter, quarterStartDate } from "../../quarters.js";
import { EDITION } from "../ipss/ipss-client.js";
import type { BigQueryWriter } from "./bigquery-writer.js";
import {
  condoTransactionRow,
  landPriceRow,
  municipalityRow,
  projectionRow,
  RAW_CONDO_TRANSACTIONS,
  RAW_LAND_PRICES,
  RAW_MUNICIPALITIES,
  RAW_POPULATION_PROJECTION,
  RAW_STATION_TRANSACTIONS,
  RAW_STATIONS,
  RAW_STATISTICS,
  RAW_TRANSACTIONS,
  stationRow,
  stationTransactionRow,
  statisticRow,
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

  async replaceLandPrices(
    year: number,
    rows: readonly { classification: "0" | "1"; record: PointRecord }[],
    fetchedAt: Date,
  ): Promise<void> {
    await this.writer.replace(
      RAW_LAND_PRICES,
      rows.map((row) => landPriceRow(row.record, year, row.classification, fetchedAt)),
      `${year}0101`,
    );
  }

  async replaceStationTransactions(
    period: { from: Quarter; to: Quarter },
    rows: readonly PointRecord[],
    fetchedAt: Date,
  ): Promise<void> {
    await this.writer.replace(
      RAW_STATION_TRANSACTIONS,
      rows.map((row) => stationTransactionRow(row, period.from, period.to, fetchedAt)),
    );
  }

  async replaceCondoTransactions(
    period: { from: Quarter; to: Quarter },
    rows: readonly PointRecord[],
    fetchedAt: Date,
  ): Promise<void> {
    await this.writer.replace(
      RAW_CONDO_TRANSACTIONS,
      rows.map((row) => condoTransactionRow(row, period.from, period.to, fetchedAt)),
    );
  }

  async replaceStations(rows: readonly StationRecord[], fetchedAt: Date): Promise<void> {
    await this.writer.replace(
      RAW_STATIONS,
      rows.map((row) => stationRow(row, fetchedAt)),
    );
  }

  async replaceProjections(rows: readonly ProjectionRecord[], fetchedAt: Date): Promise<void> {
    await this.writer.replace(
      RAW_POPULATION_PROJECTION,
      rows.map((row) => projectionRow(EDITION, row, fetchedAt)),
    );
  }

  async replaceStatistics(
    rows: readonly { table: StatisticsTable; record: StatisticRecord }[],
    fetchedAt: Date,
  ): Promise<void> {
    await this.writer.replace(
      RAW_STATISTICS,
      rows.map((row) => statisticRow(row.table, row.record, fetchedAt)),
    );
  }
}
