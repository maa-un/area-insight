import type {
  MunicipalityRecord,
  PointRecord,
  ProjectionRecord,
  StationRecord,
  StatisticRecord,
  StatisticsTable,
  TransactionRecord,
} from "../../ports.js";
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

// 位置付きのデータは、座標と属性（JSON 文字列のまま）を持つ。属性の解釈は集計の SQL で行う。
const pointColumns = [
  { name: "longitude", type: "FLOAT", mode: "REQUIRED" },
  { name: "latitude", type: "FLOAT", mode: "REQUIRED" },
  { name: "properties", type: "JSON", mode: "REQUIRED" },
  { name: "fetched_at", type: "TIMESTAMP", mode: "REQUIRED" },
];

function pointRow(record: PointRecord, fetchedAt: Date): Record<string, unknown> {
  return {
    longitude: record.coordinates[0],
    latitude: record.coordinates[1],
    // JSON 型の列には、文字列にせずオブジェクトのまま渡す（文字列にすると JSON の文字列として保存される）
    properties: record.properties,
    fetched_at: fetchedAt.toISOString(),
  };
}

// 地価公示（0）・地価調査（1）の地点。対象年の 1 月 1 日でパーティションを切る。
export const RAW_LAND_PRICES: TableSpec = {
  name: "raw_land_prices",
  partitionField: "target_year_start",
  schema: [
    { name: "target_year_start", type: "DATE", mode: "REQUIRED" },
    { name: "price_classification", type: "STRING", mode: "REQUIRED" },
    ...pointColumns,
  ],
};

export function landPriceRow(
  record: PointRecord,
  year: number,
  classification: string,
  fetchedAt: Date,
): Record<string, unknown> {
  return {
    target_year_start: `${year}-01-01`,
    price_classification: classification,
    ...pointRow(record, fetchedAt),
  };
}

// 駅ごとの取引（位置は物件の最寄り駅）。直近の期間だけを持つ。
export const RAW_STATION_TRANSACTIONS: TableSpec = {
  name: "raw_station_transactions",
  schema: [
    { name: "period_from", type: "DATE", mode: "REQUIRED" },
    { name: "period_to", type: "DATE", mode: "REQUIRED" },
    ...pointColumns,
  ],
};

export function stationTransactionRow(
  record: PointRecord,
  from: Quarter,
  to: Quarter,
  fetchedAt: Date,
): Record<string, unknown> {
  return {
    period_from: quarterStartDate(from),
    period_to: quarterStartDate(to),
    ...pointRow(record, fetchedAt),
  };
}

// 駅（XKT015）。形（GeoJSON の geometry）と属性を JSON のまま持つ。最寄りの駅を探すのは集計の SQL で行う。
export const RAW_STATIONS: TableSpec = {
  name: "raw_stations",
  schema: [
    { name: "geometry", type: "JSON", mode: "REQUIRED" },
    { name: "properties", type: "JSON", mode: "REQUIRED" },
    { name: "fetched_at", type: "TIMESTAMP", mode: "REQUIRED" },
  ],
};

export function stationRow(record: StationRecord, fetchedAt: Date): Record<string, unknown> {
  return {
    geometry: record.geometry,
    properties: record.properties,
    fetched_at: fetchedAt.toISOString(),
  };
}

// 社人研の将来推計人口。表の 1 マス（性別 × 年齢階級 × 年）を 1 行にする。
export const RAW_POPULATION_PROJECTION: TableSpec = {
  name: "raw_population_projection",
  schema: [
    { name: "edition", type: "STRING", mode: "REQUIRED" }, // 推計の版（URL の shicyoson23 など）
    { name: "code", type: "STRING", mode: "REQUIRED" },
    { name: "name", type: "STRING", mode: "REQUIRED" },
    { name: "sex", type: "STRING", mode: "REQUIRED" },
    { name: "age_group", type: "STRING", mode: "REQUIRED" },
    { name: "year", type: "INT64", mode: "REQUIRED" },
    { name: "population", type: "INT64", mode: "NULLABLE" },
    { name: "fetched_at", type: "TIMESTAMP", mode: "REQUIRED" },
  ],
};

export function projectionRow(
  edition: string,
  record: ProjectionRecord,
  fetchedAt: Date,
): Record<string, unknown> {
  return {
    edition,
    code: record.code,
    name: record.name,
    sex: record.sex,
    age_group: record.ageGroup,
    year: record.year,
    population: record.population,
    fetched_at: fetchedAt.toISOString(),
  };
}

// e-Stat の統計値。値は記号（「-」「***」など）も含めて文字列のまま持つ。
export const RAW_STATISTICS: TableSpec = {
  name: "raw_statistics",
  schema: [
    { name: "table_name", type: "STRING", mode: "REQUIRED" },
    { name: "stats_data_id", type: "STRING", mode: "REQUIRED" },
    { name: "area_code", type: "STRING", mode: "REQUIRED" },
    { name: "categories", type: "JSON", mode: "REQUIRED" },
    { name: "time_code", type: "STRING", mode: "REQUIRED" },
    { name: "value", type: "STRING", mode: "REQUIRED" },
    { name: "unit", type: "STRING", mode: "NULLABLE" },
    { name: "fetched_at", type: "TIMESTAMP", mode: "REQUIRED" },
  ],
};

export function statisticRow(
  table: StatisticsTable,
  record: StatisticRecord,
  fetchedAt: Date,
): Record<string, unknown> {
  return {
    table_name: table.name,
    stats_data_id: table.id,
    area_code: record.areaCode,
    categories: record.categories,
    time_code: record.time,
    value: record.value,
    unit: record.unit,
    fetched_at: fetchedAt.toISOString(),
  };
}
