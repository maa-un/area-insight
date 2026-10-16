import type { DataPeriod } from "@area-insight/shared";
import { formatDate } from "@/lib/format";

// 指標の時点の表示（仕様書「時点の表示ルール」）。
//   期間のデータ: 「2025年4月〜2026年3月の取引」のように始まりと終わりを書く
//   時点のデータ: 「2023年調査」「2026年1月1日時点」のように書く
// 複数のデータを組み合わせた指標で、時点が 2 年以上離れるときは「時点がずれています」と注記する。
export const STALE_YEARS = 2;
export const STALE_NOTE = "家賃と取引価格は時点がずれています";

// 「2025-04-01」→「2025年4月」
function formatMonth(iso: string): string {
  const [y, m] = iso.split("-").map(Number);
  return `${y}年${m}月`;
}

export function formatDataPeriod(data: DataPeriod): string {
  if (data.period) return `${formatMonth(data.period.from)}〜${formatMonth(data.period.to)}の取引`;
  if (data.asOf === null) return "時点不明";
  // 住宅・土地統計調査は 5 年ごとの調査なので、調査年で示す
  if (data.source === "housing_survey") return `${data.asOf.slice(0, 4)}年調査`;
  return `${formatDate(data.asOf)}時点`;
}

// 人口増減率は「最新年と 5 年前」の比較。例: 「2021年→2026年（1月1日時点）」
export function formatPopulationChange(data: DataPeriod, years = 5): string {
  if (data.asOf === null) return "時点不明";
  const [y, m, d] = data.asOf.split("-").map(Number);
  return `${(y ?? 0) - years}年→${y}年（${m}月${d}日時点）`;
}

// 2 つのデータの時点の差（年）。期間のデータは終わりの日で見る。
export function yearsApart(a: DataPeriod, b: DataPeriod): number {
  const end = (data: DataPeriod) => Date.parse(data.period?.to ?? data.asOf ?? "");
  const diff = Math.abs(end(a) - end(b));
  return Number.isNaN(diff) ? 0 : diff / (365.25 * 24 * 60 * 60 * 1000);
}
