import {
  AreaDetail,
  AreaMetricsFile,
  LandPricePoints,
  StationMetricsList,
} from "@area-insight/shared";
import { describe, expect, it } from "vitest";
// @ts-expect-error ビルド前に動かす Node のスクリプト（型定義なし）
import { centersOf, convert, fullNames, latestRows } from "../../scripts/prepare-data.mjs";

// BigQuery の JSON 書き出しの形（INT64 は文字列）を模した行。
const exportRows = {
  data_sources: [
    {
      export_id: "2026-10-16T00:00:00.000Z",
      metric: "tradePrice",
      source: "XIT001",
      period_from: "2025-04-01",
      period_to: "2026-03-31",
      as_of: null,
    },
    {
      export_id: "2026-10-16T00:00:00.000Z",
      metric: "vacancyRate",
      source: "housing_survey",
      period_from: null,
      period_to: null,
      as_of: "2023-10-01",
    },
    {
      export_id: "2026-10-16T00:00:00.000Z",
      metric: "monthlyRent",
      source: "housing_survey",
      period_from: null,
      period_to: null,
      as_of: "2023-10-01",
    },
    {
      export_id: "2026-10-16T00:00:00.000Z",
      metric: "population",
      source: "resident_register",
      period_from: null,
      period_to: null,
      as_of: "2024-01-01",
    },
    {
      export_id: "2026-10-16T00:00:00.000Z",
      metric: "stations",
      source: "XPT001",
      period_from: "2025-04-01",
      period_to: "2026-03-31",
      as_of: null,
    },
    {
      export_id: "2026-10-16T00:00:00.000Z",
      metric: "landTrade",
      source: "XIT001",
      period_from: "2024-04-01",
      period_to: "2026-03-31",
      as_of: null,
    },
    {
      export_id: "2026-10-16T00:00:00.000Z",
      metric: "officialLandPrice",
      source: "official_land_price",
      period_from: null,
      period_to: null,
      as_of: "2026-01-01",
    },
    {
      export_id: "2026-10-16T00:00:00.000Z",
      metric: "prefectureLandPrice",
      source: "prefecture_land_price",
      period_from: null,
      period_to: null,
      as_of: null,
    },
    {
      export_id: "2026-10-16T00:00:00.000Z",
      metric: "populationProjection",
      source: "ipss_projection",
      period_from: null,
      period_to: null,
      as_of: "2023-01-01",
    },
    {
      export_id: "2026-10-16T00:00:00.000Z",
      metric: "stationLandTrade",
      source: "XPT001",
      period_from: null,
      period_to: null,
      as_of: null,
    },
  ],
  area_metrics: [
    {
      export_id: "2026-10-01T00:00:00.000Z",
      code: "20202",
      prefecture_code: "20",
      name: "古い書き出し",
      trade_count: "1",
    },
    {
      export_id: "2026-10-16T00:00:00.000Z",
      code: "20202",
      prefecture_code: "20",
      name: "松本市",
      trade_price: 1880,
      trade_count: "35",
      vacancy_rate: 13.9,
      population: "234111",
      population_change_rate: -2.6,
      gross_yield: 6.1,
      monthly_rent: 121000,
      rent_per_sqm: "1180",
      land_unit_price: "52000",
      land_trade_count: "88",
      land_price_change_rate: 2.4,
      official_land_price: "61000",
      official_land_price_change_rate: 1.1,
      land_to_official_ratio: 0.85,
      rent_gap: "42",
      land_gap: "-12",
      momentum_gap: null,
      weak_demand: false,
      center_lng: 137.97,
      center_lat: 36.23,
    },
    {
      export_id: "2026-10-16T00:00:00.000Z",
      code: "20450",
      prefecture_code: "20",
      name: "位置の無い村",
      trade_price: null,
      trade_count: "0",
      vacancy_rate: null,
      population: null,
      population_change_rate: null,
      gross_yield: null,
      monthly_rent: null,
      land_trade_count: "0",
      weak_demand: true,
      center_lng: null,
      center_lat: null,
    },
  ],
  area_details: [
    {
      export_id: "2026-10-16T00:00:00.000Z",
      code: "20202",
      population_projection: [
        { year: "2020", population: "241145" },
        { year: "2050", population: "207208" },
      ],
      quarters: [{ period: "2026Q2", price: 1900, count: "9" }],
      years: [{ year: "2026", price: 1900, count: "20" }],
      population_history: [{ year: "2024", population: "234111" }],
      recent_transactions: [
        {
          period: "2026Q2",
          district: "宮渕",
          price: 2000,
          land_area: 165,
          floor_area: null,
          building_year: "1998",
        },
      ],
      official_land_price: { price: "80000", count: "14" },
      land_prices_by_station_distance: [
        { band: "within10", price: "110000", count: "3" },
        { band: "over20", price: "52000", count: "6" },
      ],
    },
    {
      export_id: "2026-10-16T00:00:00.000Z",
      code: "20450",
      quarters: [],
      years: [],
      population_history: [],
      recent_transactions: [],
      official_land_price: null,
      land_prices_by_station_distance: [],
    },
  ],
  land_price_points: [
    {
      export_id: "2026-10-16T00:00:00.000Z",
      point_id: "15002260",
      classification: "1",
      as_of: "2025-07-01",
      code: "20202",
      longitude: 137.95,
      latitude: 36.24,
      price: "75200",
      change_rate: 0.8,
      use: "住宅地",
      location: "長野県松本市宮渕１丁目",
      station_name: "北松本",
      station_distance_m: "1200",
    },
  ],
  district_land_prices: [
    {
      export_id: "2026-10-16T00:00:00.000Z",
      code: "20202",
      district: null,
      count: "120",
      quantiles: Array.from({ length: 21 }, (_, i) => String(10000 + i * 5000)),
      median_area: "210.5",
      period_from: "2024Q3",
      period_to: "2026Q2",
    },
    {
      export_id: "2026-10-16T00:00:00.000Z",
      code: "20202",
      district: "大字里山辺",
      count: "43",
      quantiles: Array.from({ length: 21 }, (_, i) => String(8000 + i * 5000)),
      median_area: "190",
      period_from: "2024Q3",
      period_to: "2026Q2",
    },
  ],
  station_land_prices: [
    {
      export_id: "2026-10-16T00:00:00.000Z",
      station_name: "北松本",
      line_names: ["大糸線"],
      longitude: 137.96,
      latitude: 36.24,
      prefecture_code: "20",
      city_codes: ["20202"],
      count: "14",
      low: "48000",
      median: "56000",
      high: "63000",
      period_from: "2024Q3",
      period_to: "2026Q2",
      adjusted_to: "2026-01-01",
      official_by_station_distance: [{ band: "within20", price: "64000", count: "2" }],
    },
    {
      export_id: "2026-10-16T00:00:00.000Z",
      station_name: null,
      line_names: [],
      longitude: 137.1,
      latitude: 36.1,
      city_codes: ["20202"],
      count: "3",
      low: "1",
      median: "1",
      high: "1",
      period_from: "2026Q1",
      period_to: "2026Q2",
      adjusted_to: null,
      official_by_station_distance: [],
    },
  ],
  station_metrics: [
    {
      export_id: "2026-10-16T00:00:00.000Z",
      city_name: "松本市",
      station_name: "松本",
      line_names: ["大糸線", "篠ノ井線"],
      longitude: 137.97,
      latitude: 36.23,
      median_price: "2000",
      count: "12",
    },
  ],
};

describe("prepare-data", () => {
  it("prefixes the wards of designated cities with the city name", () => {
    const names = fullNames([
      { code: "14100", prefecture_code: "14", name: "横浜市" },
      { code: "14113", prefecture_code: "14", name: "緑区" },
      { code: "14130", prefecture_code: "14", name: "川崎市" },
      { code: "14150", prefecture_code: "14", name: "相模原市" },
      { code: "14151", prefecture_code: "14", name: "緑区" },
      { code: "14201", prefecture_code: "14", name: "横須賀市" },
      { code: "13102", prefecture_code: "13", name: "中央区" },
      { code: "01403", prefecture_code: "01", name: "泊村" },
    ]);
    expect(names.get("14113")).toBe("横浜市緑区");
    expect(names.get("14151")).toBe("相模原市緑区");
    expect(names.get("14100")).toBe("横浜市");
    expect(names.get("14201")).toBe("横須賀市");
    expect(names.get("13102")).toBe("中央区");
    expect(names.get("01403")).toBe("泊村");
  });

  it("keeps only the rows of the latest export", () => {
    expect(latestRows(exportRows.area_metrics).map((r: { name: string }) => r.name)).toEqual([
      "松本市",
      "位置の無い村",
    ]);
  });

  it("produces data that matches the shared schemas", () => {
    const data = convert(exportRows);
    const metrics = AreaMetricsFile.parse(data.metrics);
    expect(metrics.sample).toBe(false);
    expect(metrics.updatedAt).toBe("2026-10-16");
    expect(metrics.sources.tradePrice).toEqual({
      source: "XIT001",
      period: { from: "2025-04-01", to: "2026-03-31" },
      asOf: null,
    });
    // 取り込む前の地価・駅の土地は時点が null のまま通る
    expect(metrics.sources.prefectureLandPrice.asOf).toBeNull();
    expect(metrics.sources.stationLandTrade.period).toBeNull();
    expect(metrics.sources.vacancyRate).toEqual({
      source: "housing_survey",
      period: null,
      asOf: "2023-10-01",
    });
    expect(metrics.areas[0]).toMatchObject({
      population: 234111,
      tradeCount: 35,
      landUnitPrice: 52000,
      landTradeCount: 88,
      landToOfficialRatio: 0.85,
      rentGap: 42,
      landGap: -12,
      momentumGap: null,
      weakDemand: false,
      center: [137.97, 36.23],
    });
    expect(metrics.areas[1]).toMatchObject({ center: null, landTradeCount: 0, weakDemand: true });

    // 駅の土地の坪単価は、その市区町村の土地が取引された駅だけ。駅名の付かない点は出さない
    const detail = AreaDetail.parse(data.details[0]);
    expect(detail.stationLandPrices).toHaveLength(1);
    expect(detail.stationLandPrices[0]).toMatchObject({
      stationName: "北松本",
      low: 48000,
      high: 63000,
      adjustedTo: "2026-01-01",
      officialByStationDistance: [{ band: "within20", price: 64000, count: 2 }],
    });
    expect(AreaDetail.parse(data.details[1]).stationLandPrices).toEqual([]);

    expect(AreaDetail.parse(data.details[0]).recentTransactions[0]?.buildingYear).toBe(1998);
    expect(AreaDetail.parse(data.details[0]).populationProjection).toEqual([
      { year: 2020, population: 241145 },
      { year: 2050, population: 207208 },
    ]);
    expect(LandPricePoints.parse(data.landPrices)[0]).toMatchObject({
      price: 75200,
      kind: "prefecture",
      asOf: "2025-07-01",
      stationName: "北松本",
      stationDistance: 1200,
    });
    expect(StationMetricsList.parse(data.stations)[0]).toMatchObject({
      stationName: "松本",
      lineNames: ["大糸線", "篠ノ井線"],
      medianPrice: 2000,
    });
  });

  it("uses the boundary centers, keeping the job's center only for areas without a boundary", () => {
    const centers = centersOf({
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          properties: { code: "20450", center: [137.6, 35.9] },
          geometry: { type: "MultiPolygon", coordinates: [] },
        },
      ],
    });
    const { areas } = AreaMetricsFile.parse(convert(exportRows, centers).metrics);
    expect(areas.map((a) => a.center)).toEqual([
      [137.97, 36.23],
      [137.6, 35.9],
    ]);
  });

  it("attaches the official land prices and the bands by station distance", () => {
    const data = convert(exportRows);
    const detail = AreaDetail.parse(data.details[0]);
    expect(detail.officialLandPrices.residential).toEqual({ price: 80000, count: 14 });
    expect(detail.officialLandPrices.byStationDistance).toEqual([
      { band: "within10", price: 110000, count: 3 },
      { band: "over20", price: 52000, count: 6 },
    ]);
    expect(AreaDetail.parse(data.details[1]).officialLandPrices).toEqual({
      residential: null,
      byStationDistance: [],
    });
  });

  it("attaches land price distributions to each area and falls back to empty", () => {
    const data = convert(exportRows);
    const detail = AreaDetail.parse(data.details[0]);
    expect(detail.landPrices.periodFrom).toBe("2024Q3");
    expect(detail.landPrices.total?.count).toBe(120);
    expect(detail.landPrices.total?.quantiles[10]).toBe(60000);
    expect(detail.landPrices.districts).toEqual([
      expect.objectContaining({ district: "大字里山辺", count: 43, medianArea: 190 }),
    ]);

    const without = convert({ ...exportRows, district_land_prices: [] });
    expect(AreaDetail.parse(without.details[0]).landPrices).toEqual({
      periodFrom: null,
      periodTo: null,
      total: null,
      districts: [],
    });
  });
});
