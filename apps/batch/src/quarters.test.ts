import { describe, expect, it } from "vitest";
import { parseQuarter, quarterOf, quarterStartDate, recentQuarters } from "./quarters.js";

describe("quarters", () => {
  it("derives the quarter of a date", () => {
    expect(quarterOf(new Date("2026-10-15T00:00:00Z"))).toEqual({ year: 2026, quarter: 4 });
    expect(quarterOf(new Date("2026-01-01T00:00:00Z"))).toEqual({ year: 2026, quarter: 1 });
  });

  it("lists recent quarters newest first, skipping the current one", () => {
    expect(recentQuarters(new Date("2026-02-01T00:00:00Z"), 3)).toEqual([
      { year: 2025, quarter: 4 },
      { year: 2025, quarter: 3 },
      { year: 2025, quarter: 2 },
    ]);
  });

  it("formats the first day of a quarter", () => {
    expect(quarterStartDate({ year: 2025, quarter: 3 })).toBe("2025-07-01");
  });

  it("parses quarter arguments", () => {
    expect(parseQuarter("2025Q2")).toEqual({ year: 2025, quarter: 2 });
    expect(() => parseQuarter("2025-2")).toThrow();
  });
});
