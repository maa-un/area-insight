import { describe, expect, it } from "vitest";
import { clampPage, pageCount, pageItems, pageSlice } from "./pagination";

describe("pagination", () => {
  it("件数からページ数を出す（0 件でも 1 ページ）", () => {
    expect(pageCount(0, 50)).toBe(1);
    expect(pageCount(50, 50)).toBe(1);
    expect(pageCount(51, 50)).toBe(2);
  });

  it("範囲外のページは端に寄せる", () => {
    expect(clampPage(0, 120, 50)).toBe(1);
    expect(clampPage(9, 120, 50)).toBe(3);
    expect(clampPage(Number.NaN, 120, 50)).toBe(1);
  });

  it("指定のページの分だけ切り出す", () => {
    expect(pageSlice([1, 2, 3, 4, 5], 2, 2)).toEqual([3, 4]);
    expect(pageSlice([1, 2, 3, 4, 5], 3, 2)).toEqual([5]);
  });

  it("先頭・末尾・前後だけを出し、間を省く", () => {
    expect(pageItems(1, 1)).toEqual([1]);
    expect(pageItems(1, 5)).toEqual([1, 2, "gap", 5]);
    expect(pageItems(3, 5)).toEqual([1, 2, 3, 4, 5]);
    expect(pageItems(10, 35)).toEqual([1, "gap", 9, 10, 11, "gap", 35]);
  });
});
