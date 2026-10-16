import { strToU8, zipSync } from "fflate";
import { describe, expect, it, vi } from "vitest";
import { IpssClient, parseWorkbook } from "./ipss-client.js";

// 社人研の Excel と同じ並び（2 行目にコードと名前、4 行目に「男女計」と年、5 行目から年齢階級）を最小限で作る。
function workbook(): Uint8Array {
  const strings = ["男女計", "総数", "0～4歳", "2020年", "2050年", "松本市", "男"];
  const s = (ref: string, index: number) => `<c r="${ref}" t="s"><v>${index}</v></c>`;
  const n = (ref: string, value: number) => `<c r="${ref}"><v>${value}</v></c>`;
  const sheet = `<?xml version="1.0"?><worksheet><sheetData>
    <row r="2">${n("A2", 20202)}${s("B2", 5)}</row>
    <row r="4">${s("A4", 0)}${s("B4", 3)}${s("C4", 4)}${s("J4", 6)}${s("K4", 3)}</row>
    <row r="5">${s("A5", 1)}${n("B5", 240000)}${n("C5", 200000)}${s("J5", 1)}${n("K5", 118000)}</row>
    <row r="6">${s("A6", 2)}${n("B6", 9000)}<c r="C6"/></row>
    </sheetData></worksheet>`;
  return zipSync({
    "xl/workbook.xml": strToU8(
      `<workbook><sheets><sheet name="20202_松本市" sheetId="1" r:id="rId1"/></sheets></workbook>`,
    ),
    "xl/_rels/workbook.xml.rels": strToU8(
      `<Relationships><Relationship Id="rId1" Type="x" Target="worksheets/sheet1.xml"/></Relationships>`,
    ),
    "xl/sharedStrings.xml": strToU8(
      `<sst>${strings.map((t) => `<si><t>${t}</t></si>`).join("")}</sst>`,
    ),
    "xl/worksheets/sheet1.xml": strToU8(sheet),
  });
}

describe("IpssClient", () => {
  it("reads every sex × age group × year cell of each municipality sheet", () => {
    const records = parseWorkbook(workbook());
    expect(records).toContainEqual({
      code: "20202",
      name: "松本市",
      sex: "男女計",
      ageGroup: "総数",
      year: 2050,
      population: 200000,
    });
    expect(records).toContainEqual({
      code: "20202",
      name: "松本市",
      sex: "男",
      ageGroup: "総数",
      year: 2020,
      population: 118000,
    });
    // 空のセルは null
    expect(records.find((r) => r.ageGroup === "0～4歳" && r.year === 2050)?.population).toBeNull();
    expect(records).toHaveLength(5);
  });

  it("downloads the prefecture workbook and fails loudly when it is missing", async () => {
    const fetchFn = vi
      .fn()
      .mockResolvedValueOnce(new Response(workbook()))
      .mockResolvedValueOnce(new Response(null, { status: 404 }));
    const client = new IpssClient({ requestIntervalMs: 0, fetch: fetchFn, sleep: async () => {} });
    expect(await client.projections("20")).toHaveLength(5);
    expect(String(fetchFn.mock.calls[0]?.[0])).toBe(
      "https://www.ipss.go.jp/pp-shicyoson/j/shicyoson23/3kekka/Municipalities/20.xlsx",
    );
    await expect(client.projections("99")).rejects.toThrow("IPSS 99: workbook not found");
  });
});
