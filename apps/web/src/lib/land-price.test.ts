import { describe, expect, it } from "vitest";
import { medianOf, percentileOf, quartilesOf, unitPriceOf, verdictOf } from "./land-price";

// 0, 5, 10, …, 100 の 21 値（単価 1 万〜11 万円/㎡が一様に分布している地区）
const stats = {
  count: 40,
  quantiles: Array.from({ length: 21 }, (_, i) => 10000 + i * 5000),
  medianArea: 200,
};

describe("land price distribution", () => {
  it("reads the median and quartiles from the quantiles", () => {
    expect(medianOf(stats)).toBe(60000);
    expect(quartilesOf(stats)).toEqual({ p25: 35000, p75: 85000 });
  });

  it("interpolates the percentile between quantiles", () => {
    expect(percentileOf(stats, 10000)).toBe(0);
    expect(percentileOf(stats, 60000)).toBe(50);
    expect(percentileOf(stats, 62500)).toBe(52.5);
    expect(percentileOf(stats, 110000)).toBe(100);
    expect(percentileOf(stats, 5000)).toBe(0);
    expect(percentileOf(stats, 500000)).toBe(100);
  });

  it("gives a verdict in plain words", () => {
    expect(verdictOf(10).label).toBe("かなり安い");
    expect(verdictOf(30).label).toBe("安め");
    expect(verdictOf(50).label).toBe("相場並み");
    expect(verdictOf(70).label).toBe("高め");
    expect(verdictOf(95).label).toBe("かなり高い");
  });

  it("derives the unit price from price and area", () => {
    expect(unitPriceOf(1200, 200)).toBe(60000);
    expect(unitPriceOf(0, 200)).toBeNull();
    expect(unitPriceOf(1200, 0)).toBeNull();
  });
});
