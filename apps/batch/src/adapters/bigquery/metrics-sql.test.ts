import { describe, expect, it } from "vitest";
import { metricsSql } from "./metrics-sql.js";

// SQL の正しさは BigQuery の dry run と実データで確かめる。ここでは組み立ての取り違えを防ぐ。
describe("metricsSql", () => {
  const sql = metricsSql("proj.ds");

  const table = (name: string) =>
    sql.rebuild.find((q) => q.includes(`CREATE OR REPLACE TABLE \`proj.ds.${name}\``)) ?? "";

  it("rebuilds the metric tables and the data sources from the raw tables", () => {
    const targets = sql.rebuild.map((q) => /CREATE OR REPLACE TABLE `([^`]+)`/.exec(q)?.[1]);
    // area_metrics・area_details・station_land_prices・data_sources は land_price_points（地価）を読むため、その後に作る
    expect(targets).toEqual([
      "proj.ds.land_price_points",
      "proj.ds.area_metrics",
      "proj.ds.area_details",
      "proj.ds.district_land_prices",
      "proj.ds.station_metrics",
      "proj.ds.station_land_prices",
      "proj.ds.condo_transactions",
      "proj.ds.data_sources",
    ]);
    expect(sql.rebuild.join("\n")).toContain("`proj.ds.raw_transactions`");
  });

  it("exports each table with the export id to its own folder", () => {
    const exports = sql.exports("bucket-1", "2026-10-16T00:00:00.000Z");
    expect(exports).toHaveLength(8);
    expect(exports[0]).toContain("gs://bucket-1/exports/data_sources/*.json");
    expect(exports[0]).toContain("'2026-10-16T00:00:00.000Z' AS export_id");
  });

  it("compares the 2020 census with the 2050 projection", () => {
    expect(sql.rebuild[1]).toContain("`proj.ds.raw_population_projection`");
    expect(sql.rebuild[1]).toContain("AS projected_population_2050");
    expect(sql.rebuild.join("\n")).toContain("'populationProjection', 'ipss_projection'");
  });

  it("dates each metric from its raw table", () => {
    const sources = table("data_sources");
    expect(sources).toContain("'tradePrice' AS metric, 'XIT001' AS source");
    expect(sources).toContain("DATE_SUB(quarter, INTERVAL 9 MONTH)");
    expect(sources).toContain("'vacancyRate', 'housing_survey'");
    expect(sources).toContain("'population', 'resident_register'");
    expect(sources).toContain("'stations', 'XPT001'");
    expect(sources).toContain("'landTrade', 'XIT001', DATE_SUB(quarter, INTERVAL 21 MONTH)");
    expect(sources).toContain("'stationLandTrade', 'XPT001'");
    expect(sources).toContain("'condoTrade', 'XPT001'");
    expect(sources).toContain("`proj.ds.raw_condo_transactions`");
    expect(sources).toContain("'officialLandPrice', 'official_land_price'");
    expect(sources).toContain("'prefectureLandPrice', 'prefecture_land_price'");
  });

  it("only counts detached houses (land and building)", () => {
    expect(table("area_metrics")).toContain("type = '宅地(土地と建物)'");
  });

  it("attaches the municipality, use name and station distance to each land price point", () => {
    const points = table("land_price_points");
    expect(points).toContain("AS code");
    // 「0,住宅地」→「住宅地」
    expect(points).toContain("r'([^,]+)$'");
    expect(points).toContain("$.nearest_station_name_ja");
    expect(points).toContain("$.u_road_distance_to_nearest_station_name_ja");
    // 「1.2km」は m に直す
    expect(points).toContain("* 1000");
  });

  it("compares trade prices with residential official land prices by station distance", () => {
    const details = table("area_details");
    expect(details).toContain("`proj.ds.land_price_points`");
    expect(details).toContain("use = '住宅地'");
    expect(details).toContain("AS official_land_price");
    expect(details).toContain("AS land_prices_by_station_distance");
    // 徒歩 10 分 = 800m、20 分 = 1,600m
    expect(details).toContain("<= 800 THEN 'within10'");
    expect(details).toContain("<= 1600 THEN 'within20'");
    expect(details).toContain("ELSE 'over20'");
  });

  it("names each station point after the nearest station line", () => {
    const stationMetrics = table("station_metrics");
    expect(stationMetrics).toContain("`proj.ds.raw_stations`");
    expect(stationMetrics).toContain(
      "ST_DWITHIN(ST_GEOGPOINT(p.longitude, p.latitude), s.geography, 300)",
    );
  });

  it("pads municipality codes that come back without the leading zero", () => {
    // XIT001 は函館市 01202 を "1202" で返す
    expect(table("area_metrics")).toContain("LPAD(municipality_code, 5, '0')");
  });

  it("reads JSON columns stored either as objects or as JSON strings", () => {
    const all = sql.rebuild.join("\n");
    expect(all).toContain("JSON_TYPE(categories) = 'string'");
    expect(all).toContain("JSON_TYPE(properties) = 'string'");
    expect(all).not.toMatch(/JSON_VALUE\((properties|categories), '\$/);
  });

  it("builds land price distributions per district and for the whole municipality", () => {
    const district = table("district_land_prices");
    expect(district).toContain("type = '宅地(土地)'");
    expect(district).toContain("APPROX_QUANTILES(unit_price, 20)");
    expect(district).toContain("NULL AS district");
  });

  it("keeps the latest year of each land price kind with its as-of date", () => {
    const points = table("land_price_points");
    // 地価調査は 9 月公表のため、地価公示と別に最新の年を選ぶ
    expect(points).toContain("GROUP BY price_classification");
    expect(points).toContain("JOIN latest USING (price_classification, target_year_start)");
    // 地価調査は 7 月 1 日の時点
    expect(points).toContain(
      "IF(price_classification = '1', DATE_ADD(target_year_start, INTERVAL 6 MONTH)",
    );
  });

  it("ranks demand against price within each prefecture for the distortion gaps", () => {
    const metrics = table("area_metrics");
    expect(metrics).toContain("PARTITION BY prefecture_code, population_change_rate IS NULL");
    // 比べる市区町村が 5 未満なら順位を出さない
    expect(metrics).toContain("COUNT(rent_per_sqm) OVER (PARTITION BY prefecture_code) < 5");
    expect(metrics).toContain("(population_rank - rent_rank) * 100) AS INT64) AS rent_gap");
    expect(metrics).toContain("(population_rank - land_rank) * 100) AS INT64) AS land_gap");
    expect(metrics).toContain(
      "(official_change_rank - land_change_rank) * 100) AS INT64) AS momentum_gap",
    );
    // 件数の少ない取引の値は順位に使わない
    expect(metrics).toContain(
      "IF(land_trade_count >= 10, land_unit_price, NULL) AS reliable_land_unit_price",
    );
    expect(metrics).toContain("yield_rank >= 0.8 AND population_change_rate < 0");
  });

  it("compares land trades with residential official land prices", () => {
    const metrics = table("area_metrics");
    expect(metrics).toContain("`proj.ds.land_price_points` WHERE use = '住宅地'");
    expect(metrics).toContain("AS land_to_official_ratio");
    expect(metrics).toContain("AS land_price_change_rate");
  });

  it("adjusts station land trades to the latest official land price date", () => {
    const station = table("station_land_prices");
    expect(station).toContain("land_type = '宅地(土地)'");
    expect(station).toContain("$.u_transaction_price_unit_price_square_meter_ja");
    expect(station).toContain("POW(1 + c.rate / 100");
    expect(station).toContain("INTERVAL 45 DAY), DAY) / 365.25");
    expect(station).toContain("quantiles[SAFE_OFFSET(25)]) AS low");
    expect(station).toContain("quantiles[SAFE_OFFSET(75)]) AS high");
    expect(station).toContain("AS official_by_station_distance");
  });

  it("limits station trade prices to the latest four quarters of the fetched eight", () => {
    const station = table("station_metrics");
    expect(station).toContain("$.point_in_time_name_ja");
    expect(station).toContain("land_type = '宅地(土地と建物)'");
    expect(station).toContain("INTERVAL 12 MONTH");
  });

  it("names each condo trade after its nearest station and reads its values", () => {
    const condos = table("condo_transactions");
    expect(condos).toContain("`proj.ds.raw_condo_transactions`");
    expect(condos).toContain("`proj.ds.raw_stations`");
    expect(condos).toContain("$.u_area_ja");
    // 「３ＬＤＫ」→「3LDK」
    expect(condos).toContain("NORMALIZE(JSON_VALUE(");
    expect(condos).toContain("WHEN '平成' THEN 1988");
    expect(condos).toContain("r'成約'),\n          'contract', 'transaction') AS kind");
    expect(condos).toContain("WHERE period_start IS NOT NULL AND price > 0 AND area > 0");
  });
});
