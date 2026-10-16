import { describe, expect, it } from "vitest";
import { yearName } from "./trend-chart";

describe("yearName", () => {
  it("marks the year of the latest quarter as partial unless it ends in Q4", () => {
    expect(yearName(2026, "2026Q1")).toBe("2026年（3月まで）");
    expect(yearName(2025, "2026Q1")).toBe("2025年");
    expect(yearName(2025, "2025Q4")).toBe("2025年");
    expect(yearName(2025, undefined)).toBe("2025年");
  });
});
