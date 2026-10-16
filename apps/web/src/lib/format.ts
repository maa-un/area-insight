// 指標の表示形式。値が無いときは「データなし」。
const integer = new Intl.NumberFormat("ja-JP", { maximumFractionDigits: 0 });
const decimal = new Intl.NumberFormat("ja-JP", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

export const NO_DATA = "データなし";

export function formatManYen(value: number | null): string {
  return value === null ? NO_DATA : `${integer.format(value)}万円`;
}

export function formatYen(value: number | null): string {
  return value === null ? NO_DATA : `${integer.format(value)}円`;
}

export function formatYenPerSqm(value: number | null): string {
  return value === null ? NO_DATA : `${integer.format(value)}円/㎡`;
}

// 1 坪 = 400/121 ㎡（約 3.306 ㎡）。坪単価は ㎡単価に 400/121 を掛け、1 円未満を四捨五入する。
export const SQM_PER_TSUBO = 400 / 121;

export function formatYenPerTsubo(valuePerSqm: number | null): string {
  return valuePerSqm === null ? NO_DATA : `${integer.format(valuePerSqm * SQM_PER_TSUBO)}円/坪`;
}

export function formatPercent(value: number | null, { signed = false } = {}): string {
  if (value === null) return NO_DATA;
  const sign = signed && value > 0 ? "+" : "";
  return `${sign}${decimal.format(value)}%`;
}

export function formatCount(value: number | null, unit: string): string {
  return value === null ? NO_DATA : `${integer.format(value)}${unit}`;
}

// 「2026-09-30」→「2026年9月30日」
export function formatDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return `${y}年${m}月${d}日`;
}

// 「2025Q2」→「2025年4〜6月」
export function formatQuarter(label: string): string {
  const [year, q] = label.split("Q").map(Number);
  const start = ((q ?? 1) - 1) * 3 + 1;
  return `${year}年${start}〜${start + 2}月`;
}

// ランキング・比較で使う指標の表示。キーは data/index.ts の METRICS と同じ。
export function formatMetric(key: string, value: number | null): string {
  switch (key) {
    case "tradePrice":
      return formatManYen(value);
    case "population":
      return formatCount(value, "人");
    case "populationChangeRate":
      return formatPercent(value, { signed: true });
    default:
      return formatPercent(value);
  }
}
