import type { AreaMetrics } from "@area-insight/shared";
import { describe, expect, it } from "vitest";
import { areaVerdict } from "./verdict";

const base: AreaMetrics = {
  code: "20202",
  prefectureCode: "20",
  name: "松本市",
  tradePrice: 2500,
  tradeCount: 206,
  vacancyRate: 13.9,
  population: 234111,
  populationChangeRate: -1.9,
  grossYield: 6.7,
  monthlyRent: 140000,
  rentPerSqm: null,
  landUnitPrice: null,
  landTradeCount: 0,
  landPriceChangeRate: null,
  officialLandPrice: null,
  officialLandPriceChangeRate: null,
  landToOfficialRatio: null,
  rentGap: null,
  landGap: null,
  momentumGap: null,
  weakDemand: false,
  center: null,
};

describe("areaVerdict", () => {
  it("summarises price position, population and vacancy in one sentence", () => {
    const verdict = areaVerdict(base, "長野県", { rank: 15, total: 20 });
    expect(verdict?.sentence).toBe(
      "長野県内で取引価格は高い部類。人口は微減、空き家率は全国並み。",
    );
    expect(verdict?.tags.map((t) => t.label)).toEqual([
      "価格 高い部類",
      "人口 微減",
      "空き家 全国並み",
    ]);
  });

  it("calls the cheapest third cheap and flags many vacant houses", () => {
    const verdict = areaVerdict(
      { ...base, vacancyRate: 53.4, populationChangeRate: -9.1 },
      "静岡県",
      { rank: 2, total: 30 },
    );
    expect(verdict?.sentence).toBe(
      "静岡県内で取引価格は安い部類。人口は減っている、空き家が多い。",
    );
    expect(verdict?.tags.map((t) => t.tone)).toEqual(["good", "bad", "bad"]);
  });

  it("skips what it cannot judge", () => {
    expect(
      areaVerdict({ ...base, vacancyRate: null, populationChangeRate: null }, "長野県", undefined),
    ).toBeNull();
    const verdict = areaVerdict({ ...base, vacancyRate: null }, "長野県", undefined);
    expect(verdict?.sentence).toBe("長野県内で人口は微減。");
  });
});
