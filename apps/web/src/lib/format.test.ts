import { describe, expect, it } from "vitest";
import { formatYenPerSqm, formatYenPerTsubo, NO_DATA } from "./format";

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
});
