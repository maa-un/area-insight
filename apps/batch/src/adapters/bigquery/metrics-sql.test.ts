import { describe, expect, it } from "vitest";
import { metricsSql } from "./metrics-sql.js";

// SQL の正しさは BigQuery の dry run と実データで確かめる。ここでは組み立ての取り違えを防ぐ。
describe("metricsSql", () => {
  const sql = metricsSql("proj.ds");

  it("rebuilds the metric tables and the data sources from the raw tables", () => {
    const targets = sql.rebuild.map((q) => /CREATE OR REPLACE TABLE `([^`]+)`/.exec(q)?.[1]);
    expect(targets).toEqual([
      "proj.ds.area_metrics",
      "proj.ds.area_details",
      "proj.ds.district_land_prices",
      "proj.ds.land_price_points",
      "proj.ds.station_metrics",
      "proj.ds.data_sources",
    ]);
    expect(sql.rebuild.join("\n")).toContain("`proj.ds.raw_transactions`");
  });

  it("exports each table with the export id to its own folder", () => {
    const exports = sql.exports("bucket-1", "2026-10-16T00:00:00.000Z");
    expect(exports).toHaveLength(6);
    expect(exports[0]).toContain("gs://bucket-1/exports/data_sources/*.json");
    expect(exports[0]).toContain("'2026-10-16T00:00:00.000Z' AS export_id");
  });

  it("dates each metric from its raw table", () => {
    const sources = sql.rebuild[5] ?? "";
    expect(sources).toContain("'tradePrice' AS metric, 'XIT001' AS source");
    expect(sources).toContain("DATE_SUB(quarter, INTERVAL 9 MONTH)");
    expect(sources).toContain("'vacancyRate', 'housing_survey'");
    expect(sources).toContain("'population', 'resident_register'");
    expect(sources).toContain("'stations', 'XPT001'");
  });

  it("only counts detached houses (land and building)", () => {
    expect(sql.rebuild[0]).toContain("type = '宅地(土地と建物)'");
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
    const district = sql.rebuild[2] ?? "";
    expect(district).toContain("type = '宅地(土地)'");
    expect(district).toContain("APPROX_QUANTILES(unit_price, 20)");
    expect(district).toContain("NULL AS district");
  });
});
