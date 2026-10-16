import { describe, expect, it } from "vitest";
import {
  AreaDetail,
  AreaMetricsFile,
  CompareList,
  DistortionGap,
  LandPriceStats,
  MunicipalityCode,
  PREFECTURE_CODES,
  PrefectureCode,
  prefectureName,
  SavedFilter,
} from "./index.js";

describe("MunicipalityCode", () => {
  it("accepts a 5-digit code", () => {
    expect(MunicipalityCode.parse("13101")).toBe("13101");
  });

  it("rejects codes that are not 5 digits", () => {
    expect(MunicipalityCode.safeParse("131016").success).toBe(false);
    expect(MunicipalityCode.safeParse("1310a").success).toBe(false);
  });
});

describe("PrefectureCode", () => {
  it("lists all 47 prefectures", () => {
    expect(PREFECTURE_CODES).toHaveLength(47);
    expect(PREFECTURE_CODES[0]).toBe("01");
    expect(PREFECTURE_CODES.at(-1)).toBe("47");
    expect(PREFECTURE_CODES.every((code) => PrefectureCode.safeParse(code).success)).toBe(true);
  });

  it("rejects out-of-range codes", () => {
    expect(PrefectureCode.safeParse("00").success).toBe(false);
    expect(PrefectureCode.safeParse("48").success).toBe(false);
  });
});

describe("user data", () => {
  it("limits the compare list to three areas", () => {
    expect(CompareList.safeParse(["13101", "13102", "13103"]).success).toBe(true);
    expect(CompareList.safeParse(["13101", "13102", "13103", "13104"]).success).toBe(false);
  });

  it("accepts a saved filter with simple values", () => {
    const filter = {
      name: "安い順",
      conditions: { maxPrice: 500, use: "residential", onlyAkiya: true },
    };
    expect(SavedFilter.parse(filter)).toEqual(filter);
  });
});

describe("prefectureName", () => {
  it("maps codes to names", () => {
    expect(prefectureName("01")).toBe("北海道");
    expect(prefectureName("13")).toBe("東京都");
    expect(prefectureName("47")).toBe("沖縄県");
  });
});

describe("AreaMetricsFile", () => {
  it("accepts a file with nullable metrics", () => {
    const period = {
      source: "XIT001",
      period: { from: "2025-10-01", to: "2026-09-30" },
      asOf: null,
    };
    const survey = { source: "housing_survey", period: null, asOf: "2023-10-01" };
    const file = {
      updatedAt: "2026-10-16",
      sources: {
        tradePrice: period,
        vacancyRate: survey,
        monthlyRent: survey,
        population: { source: "resident_register", period: null, asOf: "2026-01-01" },
        stations: { ...period, source: "XPT001" },
        landTrade: period,
        officialLandPrice: { source: "official_land_price", period: null, asOf: "2026-01-01" },
        prefectureLandPrice: { source: "prefecture_land_price", period: null, asOf: null },
        stationLandTrade: { ...period, source: "XPT001" },
        populationProjection: { source: "ipss_projection", period: null, asOf: "2023-01-01" },
        condoTrade: { source: "XPT001", period: null, asOf: null },
      },
      sample: true,
      areas: [
        {
          code: "13101",
          prefectureCode: "13",
          name: "千代田区",
          tradePrice: null,
          tradeCount: 0,
          vacancyRate: 12.3,
          population: 68000,
          populationChangeRate: 2.1,
          projectedPopulation2050: null,
          projectedChangeRate: null,
          grossYield: null,
          monthlyRent: null,
          rentPerSqm: null,
          landUnitPrice: null,
          landTradeCount: 0,
          landPriceChangeRate: null,
          officialLandPrice: 1200000,
          officialLandPriceChangeRate: 3.4,
          landToOfficialRatio: null,
          rentGap: 35,
          landGap: null,
          momentumGap: null,
          weakDemand: false,
          center: [139.75, 35.69],
        },
      ],
    };
    expect(AreaMetricsFile.parse(file)).toEqual(file);
  });

  it("rejects a distortion gap outside -100 to 100", () => {
    expect(DistortionGap.safeParse(120).success).toBe(false);
    expect(DistortionGap.safeParse(-100).success).toBe(true);
  });

  it("rejects a quarter label in the wrong form", () => {
    const detail = { code: "13101", quarters: [{ period: "2025-2", price: 1, count: 1 }] };
    expect(
      AreaDetail.safeParse({ ...detail, years: [], populationHistory: [], recentTransactions: [] })
        .success,
    ).toBe(false);
  });

  it("requires 21 quantiles for a land price distribution", () => {
    const stats = { count: 3, quantiles: Array.from({ length: 21 }, () => 1), medianArea: null };
    expect(LandPriceStats.safeParse(stats).success).toBe(true);
    expect(LandPriceStats.safeParse({ ...stats, quantiles: [1, 2, 3] }).success).toBe(false);
  });
});
