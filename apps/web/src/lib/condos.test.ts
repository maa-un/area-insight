import type { CondoTrade } from "@area-insight/shared";
import { describe, expect, it } from "vitest";
import {
  DEFAULT_FILTERS,
  filtersFromParams,
  filtersToParams,
  filterTrades,
  planGroup,
  priceFor,
  quantile,
  summarize,
  summarizeByStation,
  toTrade,
} from "./condos";

const row = (overrides: Partial<Record<number, unknown>> = {}): CondoTrade => {
  const base: CondoTrade = [0, "2026Q2", 3300, 66, "3LDK", 2006, 1, null, "中央", "RC", ""];
  for (const [i, v] of Object.entries(overrides)) (base as unknown[])[Number(i)] = v;
  return base;
};

describe("planGroup", () => {
  it("groups layouts by the number of rooms", () => {
    expect(planGroup("1R")).toBe("1K");
    expect(planGroup("1K")).toBe("1K");
    expect(planGroup("1DK")).toBe("1LDK");
    expect(planGroup("1LDK")).toBe("1LDK");
    expect(planGroup("2LDK+S")).toBe("2LDK");
    expect(planGroup("3DK")).toBe("3LDK");
    expect(planGroup("5LDK")).toBe("4LDK");
    expect(planGroup("オープンフロア")).toBe("other");
    expect(planGroup("")).toBe("other");
  });
});

describe("toTrade", () => {
  it("names the fields and adds the unit price and the age at the trade", () => {
    const trade = toTrade(row());
    expect(trade).toMatchObject({ age: 20, contract: true, renovated: null, district: "中央" });
    expect(trade.perSqm).toBe(500000);
    expect(toTrade(row({ 5: null })).age).toBeNull();
  });
});

describe("filterTrades", () => {
  const trades = [
    toTrade(row()),
    toTrade(row({ 1: "2021Q3", 6: 0 })),
    toTrade(row({ 3: 25, 4: "1K", 5: 2024 })),
    toTrade(row({ 5: null })),
    toTrade(row({ 10: "関係者間取引" })),
  ];

  it("keeps the recent years counted back from the latest quarter", () => {
    expect(filterTrades(trades, DEFAULT_FILTERS)).toHaveLength(4);
    expect(filterTrades(trades, { ...DEFAULT_FILTERS, years: 1 })).toHaveLength(3);
  });

  it("filters by price kind, layout, area and age, dropping unknown ages", () => {
    expect(filterTrades(trades, { ...DEFAULT_FILTERS, kind: "transaction" })).toHaveLength(1);
    expect(filterTrades(trades, { ...DEFAULT_FILTERS, plans: ["1K"] })).toHaveLength(1);
    expect(filterTrades(trades, { ...DEFAULT_FILTERS, areaMin: 30 })).toHaveLength(3);
    const young = filterTrades(trades, { ...DEFAULT_FILTERS, ageMax: 5 });
    expect(young.map((t) => t.plan)).toEqual(["1K"]);
    expect(filterTrades(trades, { ...DEFAULT_FILTERS, ageMin: 10 })).toHaveLength(2);
  });

  it("includes trades with special circumstances only when asked", () => {
    expect(filterTrades(trades, { ...DEFAULT_FILTERS, includeSpecial: true })).toHaveLength(5);
  });
});

describe("summaries", () => {
  it("interpolates quantiles", () => {
    expect(quantile([1, 2, 3, 4, 5], 0.25)).toBe(2);
    expect(quantile([10, 20], 0.5)).toBe(15);
    expect(quantile([], 0.5)).toBeNull();
  });

  it("summarizes unit prices per station", () => {
    const trades = [100, 200, 300, 400, 500].map((price, i) =>
      toTrade(row({ 0: i % 2, 2: price, 3: 10 })),
    );
    const all = summarize(trades);
    expect(all).toMatchObject({ count: 5, contractCount: 5, median: 300000, medianPrice: 300 });
    const byStation = summarizeByStation(trades);
    expect(byStation.get(0)?.count).toBe(3);
    expect(byStation.get(1)?.median).toBe(300000);
    expect(summarize([])).toBeNull();
    expect(priceFor(500000, 60)).toBe(3000);
  });
});

describe("filter params", () => {
  it("round-trips the filters and leaves out the defaults", () => {
    const filters = {
      ...DEFAULT_FILTERS,
      years: 3 as const,
      plans: ["1K" as const, "3LDK" as const],
      areaMin: 40,
      ageMax: 10,
    };
    const params = filtersToParams(filters);
    expect(params).toMatchObject({ years: "3", plans: "1K,3LDK", amin: "40", agemax: "10" });
    expect(params.kind).toBeUndefined();
    const search = new URLSearchParams(
      Object.entries(params).filter((e): e is [string, string] => e[1] !== undefined),
    );
    expect(filtersFromParams(search)).toEqual(filters);
    expect(filtersFromParams(new URLSearchParams("years=7&plans=9LDK&amin=-1"))).toEqual(
      DEFAULT_FILTERS,
    );
  });
});
