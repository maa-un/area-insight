import { PREFECTURE_CODES } from "@area-insight/shared";
import type { BigQueryWriter, TableSpec } from "../bigquery.js";
import { type Quarter, quarterStartDate } from "../quarters.js";
import type { ReinfolibClient, TransactionRow } from "../reinfolib.js";

// API の項目名（PascalCase）-> 列名（snake_case）。値は文字列のまま保存し、数値化は集計で行う。
const COLUMNS = {
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
    ...Object.values(COLUMNS).map((name) => ({ name, type: "STRING", mode: "NULLABLE" })),
  ],
};

export function toRow(
  row: TransactionRow,
  quarter: Quarter,
  prefectureCode: string,
  now: Date,
): Record<string, unknown> {
  const out: Record<string, unknown> = {
    period_start: quarterStartDate(quarter),
    prefecture_code: prefectureCode,
    fetched_at: now.toISOString(),
  };
  for (const [key, column] of Object.entries(COLUMNS)) {
    const value = row[key as keyof typeof COLUMNS];
    out[column] = value === undefined || value === "" ? null : value;
  }
  return out;
}

// 四半期ごとに 47 都道府県を取り直し、その四半期のパーティションを丸ごと置き換える。
export async function fetchTransactions(
  client: ReinfolibClient,
  writer: BigQueryWriter,
  quarters: Quarter[],
  now: Date,
): Promise<Map<string, number>> {
  const counts = new Map<string, number>();
  for (const quarter of quarters) {
    const rows: Record<string, unknown>[] = [];
    for (const prefectureCode of PREFECTURE_CODES) {
      const fetched = await client.transactions(prefectureCode, quarter.year, quarter.quarter);
      rows.push(...fetched.map((row) => toRow(row, quarter, prefectureCode, now)));
    }
    await writer.replace(RAW_TRANSACTIONS, rows, quarterStartDate(quarter).replaceAll("-", ""));
    counts.set(`${quarter.year}Q${quarter.quarter}`, rows.length);
  }
  return counts;
}
