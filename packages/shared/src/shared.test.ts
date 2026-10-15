import { describe, expect, it } from "vitest";
import {
  CompareList,
  MunicipalityCode,
  PREFECTURE_CODES,
  PrefectureCode,
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
