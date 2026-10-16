import { describe, expect, it } from "vitest";
import {
  formatDataPeriod,
  formatLandPriceAsOf,
  formatPopulationChange,
  yearsApart,
} from "./period";

const trade = {
  source: "XIT001",
  period: { from: "2025-04-01", to: "2026-03-31" },
  asOf: null,
} as const;
const survey = { source: "housing_survey", period: null, asOf: "2023-10-01" } as const;
const register = { source: "resident_register", period: null, asOf: "2024-01-01" } as const;

describe("period", () => {
  it("writes periods with their start and end, and points in time as such", () => {
    expect(formatDataPeriod(trade)).toBe("2025年4月〜2026年3月の取引");
    expect(formatDataPeriod(survey)).toBe("2023年調査");
    expect(formatDataPeriod(register)).toBe("2024年1月1日時点");
    expect(formatDataPeriod({ source: "XIT001", period: null, asOf: null })).toBe("時点不明");
  });

  it("shows the two years a population change compares", () => {
    expect(formatPopulationChange(register)).toBe("2019年→2024年（1月1日時点）");
  });

  it("measures how far apart two data points are", () => {
    expect(yearsApart(trade, survey)).toBeCloseTo(2.5, 1);
    expect(yearsApart(trade, trade)).toBe(0);
  });
});

describe("formatLandPriceAsOf", () => {
  const official = { source: "official_land_price", period: null, asOf: "2026-01-01" } as const;
  const prefecture = { source: "prefecture_land_price", period: null, asOf: "2025-07-01" } as const;
  it("lists both land price dates and skips missing ones", () => {
    expect(
      formatLandPriceAsOf({ officialLandPrice: official, prefectureLandPrice: prefecture }),
    ).toBe("公示地価 2026年1月1日時点・基準地価 2025年7月1日時点");
    expect(
      formatLandPriceAsOf({
        officialLandPrice: official,
        prefectureLandPrice: { ...prefecture, asOf: null },
      }),
    ).toBe("公示地価 2026年1月1日時点");
    expect(
      formatLandPriceAsOf({
        officialLandPrice: { ...official, asOf: null },
        prefectureLandPrice: { ...prefecture, asOf: null },
      }),
    ).toBe("地価 時点不明");
  });
});
