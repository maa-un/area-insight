import type { AreaMetrics } from "@area-insight/shared";
import { RELIABLE_TRADE_COUNT } from "@area-insight/shared";
import { describe, expect, it } from "vitest";
import { rankableAreas } from "./index";

const area = (code: string, tradeCount: number): AreaMetrics => ({
  code,
  prefectureCode: code.slice(0, 2),
  name: code,
  tradePrice: 1000,
  tradeCount,
  vacancyRate: 10,
  population: 1000,
  populationChangeRate: 0,
  grossYield: 5,
  monthlyRent: 50000,
  center: null,
});

const areas = [area("20202", RELIABLE_TRADE_COUNT), area("20450", RELIABLE_TRADE_COUNT - 1)];

describe("rankableAreas", () => {
  it("drops reference values from trade-based rankings by default", () => {
    expect(rankableAreas(areas, "grossYield", false).map((a) => a.code)).toEqual(["20202"]);
    expect(rankableAreas(areas, "tradePrice", false).map((a) => a.code)).toEqual(["20202"]);
  });

  it("keeps them when asked", () => {
    expect(rankableAreas(areas, "grossYield", true)).toHaveLength(2);
  });

  it("keeps every area for statistics-based metrics", () => {
    expect(rankableAreas(areas, "vacancyRate", false)).toHaveLength(2);
    expect(rankableAreas(areas, "population", false)).toHaveLength(2);
  });
});
