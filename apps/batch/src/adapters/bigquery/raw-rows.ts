import type { MunicipalityRecord, TransactionRecord } from "../../ports.js";
import { type Quarter, quarterStartDate } from "../../quarters.js";
import type { TableSpec } from "./bigquery-writer.js";

// 生データのテーブル定義と、取得したデータを行に直す対応。BigQuery の列の都合はこのファイルに閉じ込める。

export const RAW_MUNICIPALITIES: TableSpec = {
  name: "raw_municipalities",
  schema: [
    { name: "code", type: "STRING", mode: "REQUIRED" },
    { name: "prefecture_code", type: "STRING", mode: "REQUIRED" },
    { name: "name", type: "STRING", mode: "REQUIRED" },
    { name: "fetched_at", type: "TIMESTAMP", mode: "REQUIRED" },
  ],
};

export function municipalityRow(
  record: MunicipalityRecord,
  prefectureCode: string,
  fetchedAt: Date,
): Record<string, unknown> {
  return {
    code: record.code,
    prefecture_code: prefectureCode,
    name: record.name,
    fetched_at: fetchedAt.toISOString(),
  };
}

// API の項目名（PascalCase）-> 列名（snake_case）。値は文字列のまま保存し、数値化は集計で行う。
const TRANSACTION_COLUMNS = {
  Type: "type",
  Region: "region",
  MunicipalityCode: "municipality_code",
  Prefecture: "prefecture",
  Municipality: "municipality",
  DistrictName: "district_name",
  DistrictCode: "district_code",
  TradePrice: "trade_price",
  PricePerUnit: "price_per_unit",
  UnitPrice: "unit_price",
  FloorPlan: "floor_plan",
  Area: "area",
  LandShape: "land_shape",
  Frontage: "frontage",
  TotalFloorArea: "total_floor_area",
  BuildingYear: "building_year",
  Structure: "structure",
  Use: "use",
  Purpose: "purpose",
  Direction: "direction",
  Classification: "classification",
  Breadth: "breadth",
  CityPlanning: "city_planning",
  CoverageRatio: "coverage_ratio",
  FloorAreaRatio: "floor_area_ratio",
  Period: "period",
  Renovation: "renovation",
  Remarks: "remarks",
  PriceCategory: "price_category",
} as const satisfies Record<string, string>;

export const RAW_TRANSACTIONS: TableSpec = {
  name: "raw_transactions",
  partitionField: "period_start",
  schema: [
    { name: "period_start", type: "DATE", mode: "REQUIRED" },
    { name: "prefecture_code", type: "STRING", mode: "REQUIRED" },
    { name: "fetched_at", type: "TIMESTAMP", mode: "REQUIRED" },
    ...Object.values(TRANSACTION_COLUMNS).map((name) => ({
      name,
      type: "STRING",
      mode: "NULLABLE",
    })),
  ],
};

export function transactionRow(
  record: TransactionRecord,
  quarter: Quarter,
  prefectureCode: string,
  fetchedAt: Date,
): Record<string, unknown> {
  const out: Record<string, unknown> = {
    period_start: quarterStartDate(quarter),
    prefecture_code: prefectureCode,
    fetched_at: fetchedAt.toISOString(),
  };
  for (const [key, column] of Object.entries(TRANSACTION_COLUMNS)) {
    const value = record[key];
    out[column] = value === undefined || value === "" ? null : value;
  }
  return out;
}
