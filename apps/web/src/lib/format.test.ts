import { describe, expect, it } from "vitest";
import { formatDistance, formatRatio, formatYenPerSqm, formatYenPerTsubo, NO_DATA } from "./format";

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
