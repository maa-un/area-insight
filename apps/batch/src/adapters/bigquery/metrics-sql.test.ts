import { describe, expect, it } from "vitest";
import { metricsSql } from "./metrics-sql.js";

// SQL の正しさは BigQuery の dry run と実データで確かめる。ここでは組み立ての取り違えを防ぐ。
describe("metricsSql", () => {
  const sql = metricsSql("proj.ds");

  it("rebuilds the five metric tables from the raw tables", () => {
    const targets = sql.rebuild.map((q) => /CREATE OR REPLACE TABLE `([^`]+)`/.exec(q)?.[1]);
    // area_details は land_price_points（住宅地の地価）を読むため、その後に作る
    expect(targets).toEqual([
      "proj.ds.area_metrics",
      "proj.ds.land_price_points",
      "proj.ds.area_details",
      "proj.ds.district_land_prices",
      "proj.ds.station_metrics",
    ]);
    expect(sql.rebuild.join("\n")).toContain("`proj.ds.raw_transactions`");
  });

  it("exports each table with the export id to its own folder", () => {
    const exports = sql.exports("bucket-1", "2026-10-16T00:00:00.000Z");
    expect(exports).toHaveLength(5);
    expect(exports[0]).toContain("gs://bucket-1/exports/area_metrics/*.json");
    expect(exports[0]).toContain("'2026-10-16T00:00:00.000Z' AS export_id");
  });

  it("only counts detached houses (land and building)", () => {
    expect(sql.rebuild[0]).toContain("type = '宅地(土地と建物)'");
  });

  it("attaches the municipality, use name and station distance to each land price point", () => {
    const points = sql.rebuild[1] ?? "";
    expect(points).toContain("AS code");
    // 「0,住宅地」→「住宅地」
    expect(points).toContain("r'([^,]+)$'");
    expect(points).toContain("$.nearest_station_name_ja");
    expect(points).toContain("$.u_road_distance_to_nearest_station_name_ja");
    // 「1.2km」は m に直す
    expect(points).toContain("* 1000");
  });

  it("compares trade prices with residential official land prices by station distance", () => {
    const details = sql.rebuild[2] ?? "";
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
    const stationMetrics = sql.rebuild[4] ?? "";
    expect(stationMetrics).toContain("`proj.ds.raw_stations`");
    expect(stationMetrics).toContain(
      "ST_DWITHIN(ST_GEOGPOINT(p.longitude, p.latitude), s.geography, 300)",
    );
  });

  it("pads municipality codes that come back without the leading zero", () => {
    // XIT001 は函館市 01202 を "1202" で返す
    expect(sql.rebuild[0]).toContain("LPAD(municipality_code, 5, '0')");
  });

  it("reads JSON columns stored either as objects or as JSON strings", () => {
    const all = sql.rebuild.join("\n");
    expect(all).toContain("JSON_TYPE(categories) = 'string'");
    expect(all).toContain("JSON_TYPE(properties) = 'string'");
    expect(all).not.toMatch(/JSON_VALUE\((properties|categories), '\$/);
  });

  it("builds land price distributions per district and for the whole municipality", () => {
    const district = sql.rebuild[3] ?? "";
    expect(district).toContain("type = '宅地(土地)'");
    expect(district).toContain("APPROX_QUANTILES(unit_price, 20)");
    expect(district).toContain("NULL AS district");
  });
});
