import { unzipSync } from "fflate";
import type { ProjectionRecord, ProjectionSource } from "../../ports.js";
import { type FetcherOptions, RateLimitedFetcher } from "../rate-limited-fetcher.js";

// 国立社会保障・人口問題研究所「日本の地域別将来推計人口（令和 5（2023）年推計）」の Excel を読む。
// https://www.ipss.go.jp/pp-shicyoson/j/shicyoson23/t-page.asp
// 都道府県ごとに 1 ファイル（市区町村ごとに 1 シート）。2020 年の実績（国勢調査）と 2025〜2050 年の 5 年ごとの推計を
// 男女・5 歳階級別に持つ。利用条件は PDL1.0（出典の記載と、加工した旨の表示）。
// 推計が新しくなったら EDITION（URL の shicyoson23）を差し替える。
export const EDITION = "shicyoson23";
const BASE_URL = `https://www.ipss.go.jp/pp-shicyoson/j/${EDITION}/3kekka/Municipalities`;
const SEXES = new Set(["男女計", "男", "女"]);

export class IpssClient implements ProjectionSource {
  private readonly fetcher: RateLimitedFetcher;

  constructor(options: FetcherOptions) {
    this.fetcher = new RateLimitedFetcher(options);
  }

  async projections(prefectureCode: string): Promise<ProjectionRecord[]> {
    const bytes = await this.fetcher.getBytes(
      `IPSS ${prefectureCode}`,
      `${BASE_URL}/${prefectureCode}.xlsx`,
    );
    if (bytes === null) throw new Error(`IPSS ${prefectureCode}: workbook not found`);
    return parseWorkbook(bytes);
  }
}

// xlsx（zip の中の XML）を、ライブラリを増やさずに読む。使うのは共有文字列とセルの値だけ。
export function parseWorkbook(bytes: Uint8Array): ProjectionRecord[] {
  const files = unzipSync(bytes);
  const text = (path: string) => {
    const file = files[path];
    if (!file) throw new Error(`IPSS workbook: missing ${path}`);
    return new TextDecoder().decode(file);
  };
  const strings = sharedStrings(text("xl/sharedStrings.xml"));
  const targets = relationships(text("xl/_rels/workbook.xml.rels"));
  const records: ProjectionRecord[] = [];
  for (const match of text("xl/workbook.xml").matchAll(/<sheet\b([^>]*)\/?>/g)) {
    const id = attribute(match[1] ?? "", "r:id");
    const target = id && targets.get(id);
    if (!target) continue;
    records.push(...parseSheet(cells(text(`xl/${target}`), strings)));
  }
  return records;
}

// 1 シート = 1 市区町村。2 行目にコードと名前、「男女計」「男」「女」の見出し行の下に年齢階級ごとの行が続く。
function parseSheet(cell: Map<string, string | number>): ProjectionRecord[] {
  const code = cell.get("A2");
  const name = cell.get("B2");
  if (code === undefined || typeof name !== "string") return [];
  const records: ProjectionRecord[] = [];
  for (const [ref, value] of cell) {
    if (typeof value !== "string" || !SEXES.has(value)) continue;
    const { column, row } = parseRef(ref);
    // 見出し行の右に「2020年」「2025年」… が並ぶ
    const years: { column: number; year: number }[] = [];
    for (let c = column + 1; ; c++) {
      const year = /^(\d{4})年$/.exec(String(cell.get(address(c, row)) ?? ""))?.[1];
      if (!year) break;
      years.push({ column: c, year: Number(year) });
    }
    for (let r = row + 1; ; r++) {
      const ageGroup = cell.get(address(column, r));
      if (typeof ageGroup !== "string") break;
      for (const { column: c, year } of years) {
        const population = cell.get(address(c, r));
        records.push({
          code: String(code).padStart(5, "0"),
          name,
          sex: value,
          ageGroup,
          year,
          population: typeof population === "number" ? population : null,
        });
      }
    }
  }
  return records;
}

// セルの参照 → 値。共有文字列（t="s"）は引き、数値はそのまま、それ以外の文字列も持つ。
function cells(sheetXml: string, strings: string[]): Map<string, string | number> {
  const map = new Map<string, string | number>();
  for (const match of sheetXml.matchAll(/<c\b([^>]*?)(?:\/>|>(.*?)<\/c>)/gs)) {
    const ref = attribute(match[1] ?? "", "r");
    const inner = match[2] ?? "";
    if (!ref) continue;
    const type = attribute(match[1] ?? "", "t");
    const v = /<v>(.*?)<\/v>/s.exec(inner)?.[1];
    if (type === "s") {
      if (v !== undefined) map.set(ref, strings[Number(v)] ?? "");
    } else if (type === "inlineStr") {
      map.set(ref, decodeEntities(innerText(inner)));
    } else if (type === "str" || type === "b") {
      if (v !== undefined) map.set(ref, decodeEntities(v));
    } else if (v !== undefined && v !== "") {
      map.set(ref, Number(v));
    }
  }
  return map;
}

function sharedStrings(xml: string): string[] {
  return [...xml.matchAll(/<si>(.*?)<\/si>/gs)].map((m) => decodeEntities(innerText(m[1] ?? "")));
}

function relationships(xml: string): Map<string, string> {
  const map = new Map<string, string>();
  for (const match of xml.matchAll(/<Relationship\b([^>]*)\/?>/g)) {
    const id = attribute(match[1] ?? "", "Id");
    const target = attribute(match[1] ?? "", "Target");
    if (id && target) map.set(id, target.replace(/^\//, "").replace(/^xl\//, ""));
  }
  return map;
}

// <t> の中身を連結する（書式付きの文字列は <r><t> に分かれる）。
function innerText(xml: string): string {
  return [...xml.matchAll(/<t\b[^>]*>(.*?)<\/t>/gs)].map((m) => m[1] ?? "").join("");
}

function attribute(attrs: string, name: string): string | undefined {
  return new RegExp(`(?:^|\\s)${name}="([^"]*)"`).exec(attrs)?.[1];
}

function decodeEntities(value: string): string {
  return value
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&apos;", "'")
    .replaceAll("&amp;", "&");
}

// "B5" → { column: 2, row: 5 }
function parseRef(ref: string): { column: number; row: number } {
  const match = /^([A-Z]+)(\d+)$/.exec(ref);
  if (!match) throw new Error(`IPSS workbook: bad cell reference ${ref}`);
  let column = 0;
  for (const ch of match[1] ?? "") column = column * 26 + (ch.charCodeAt(0) - 64);
  return { column, row: Number(match[2]) };
}

function address(column: number, row: number): string {
  let letters = "";
  for (let c = column; c > 0; c = Math.floor((c - 1) / 26)) {
    letters = String.fromCharCode(65 + ((c - 1) % 26)) + letters;
  }
  return `${letters}${row}`;
}
