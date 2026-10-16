import { describe, expect, it } from "vitest";
import { DomainError } from "./errors.js";
import { UserPreferences } from "./user-preferences.js";
import { userIdOf } from "./values.js";

const empty = () => UserPreferences.empty(userIdOf("user_1"));

describe("UserPreferences", () => {
  it("starts empty", () => {
    expect(empty().toSnapshot()).toEqual({ favorites: [], compare: [], filters: [] });
  });

  it("drops duplicate favorites and keeps their order", () => {
    const prefs = empty().replaceFavorites(["13101", "27100", "13101"]);
    expect(prefs.favorites).toEqual(["13101", "27100"]);
  });

  it("limits the compare list to three areas", () => {
    expect(() => empty().replaceCompare(["13101", "13102", "13103", "13104"])).toThrow(DomainError);
    // 重複を除いて 3 つなら受け付ける
    expect(empty().replaceCompare(["13101", "13102", "13103", "13101"]).compare).toHaveLength(3);
  });

  it("rejects malformed area codes", () => {
    expect(() => empty().replaceFavorites(["1310"])).toThrow(DomainError);
  });

  it("requires unique filter names", () => {
    const filter = { name: "安い順", conditions: { metric: "tradePrice" } };
    expect(() => empty().replaceFilters([filter, filter])).toThrow(DomainError);
  });

  it("does not change the original when replacing", () => {
    const original = empty();
    original.replaceFavorites(["13101"]);
    expect(original.favorites).toEqual([]);
  });

  it("restores from a snapshot", () => {
    const snapshot = { favorites: ["13101"], compare: ["27100"], filters: [] };
    expect(UserPreferences.restore(userIdOf("user_1"), snapshot).toSnapshot()).toEqual(snapshot);
  });

  it("keeps the first of duplicate filter names saved before the rule existed", () => {
    const a = { name: "安い順", conditions: { metric: "tradePrice" } };
    const b = { name: "安い順", conditions: { metric: "grossYield" } };
    const prefs = UserPreferences.restore(userIdOf("user_1"), {
      favorites: [],
      compare: [],
      filters: [a, b],
    });
    expect(prefs.filters).toEqual([a]);
  });
});
