import { describe, expect, it } from "vitest";
import {
  formatDataPeriod,
  formatDistance,
  formatGap,
  formatManYenPerTsubo,
  formatRatio,
  formatTsuboRange,
  formatYenPerSqm,
  formatYenPerTsubo,
  NO_DATA,
} from "./format";

describe("unit prices", () => {
  it("shows the price per square metre", () => {
    expect(formatYenPerSqm(121000)).toBe("121,000円/㎡");
  });

  it("converts to the price per tsubo (1 坪 = 400/121 ㎡)", () => {
    expect(formatYenPerTsubo(121000)).toBe("400,000円/坪");
    expect(formatYenPerTsubo(100000)).toBe("330,579円/坪");
  });

  it("shows no data for missing values", () => {
    expect(formatYenPerTsubo(null)).toBe(NO_DATA);
  });

  it("shows ratios and distances", () => {
    expect(formatRatio(0.853)).toBe("0.85倍");
    expect(formatRatio(null)).toBe(NO_DATA);
    expect(formatDistance(150)).toBe("150m");
    expect(formatDistance(1200)).toBe("1.2km");
  });
});

describe("tsubo prices", () => {
  it("shows the price per tsubo in ten thousand yen", () => {
    expect(formatManYenPerTsubo(121000)).toBe("40.0万円/坪");
    expect(formatManYenPerTsubo(null)).toBe(NO_DATA);
    expect(formatTsuboRange(121000, 151250)).toBe("40.0〜50.0万円/坪");
  });
});

describe("distortion gaps", () => {
  it("signs positive gaps", () => {
    expect(formatGap(42)).toBe("+42pt");
    expect(formatGap(-12)).toBe("-12pt");
    expect(formatGap(0)).toBe("0pt");
    expect(formatGap(null)).toBe(NO_DATA);
  });
});

describe("data periods", () => {
  it("shows a quarter range by month, a date as of that day and a year", () => {
    expect(formatDataPeriod({ from: "2025-07-01", to: "2026-06-30", precision: "quarter" })).toBe(
      "2025年7月〜2026年6月",
    );
    expect(formatDataPeriod({ from: null, to: "2026-01-01", precision: "day" })).toBe(
      "2026年1月1日時点",
    );
    expect(formatDataPeriod({ from: null, to: "2023-01-01", precision: "year" })).toBe("2023年");
  });
});
