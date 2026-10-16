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

// 坪単価（万円/坪、小数 1 桁）。㎡単価から換算する。
export function formatManYenPerTsubo(valuePerSqm: number | null): string {
  return valuePerSqm === null
    ? NO_DATA
    : `${decimal.format((valuePerSqm * SQM_PER_TSUBO) / 10000)}万円/坪`;
}

// 坪単価の幅（「45.2〜58.1万円/坪」）。
export function formatTsuboRange(lowPerSqm: number, highPerSqm: number): string {
  const tsubo = (v: number) => decimal.format((v * SQM_PER_TSUBO) / 10000);
  return `${tsubo(lowPerSqm)}〜${tsubo(highPerSqm)}万円/坪`;
}

// 歪みの順位の差（-100〜100）。「+42pt」
export function formatGap(value: number | null): string {
  if (value === null) return NO_DATA;
  return `${value > 0 ? "+" : ""}${integer.format(value)}pt`;
}

// 倍率。「0.85倍」のように小数 2 桁で出す。
const ratio = new Intl.NumberFormat("ja-JP", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
export function formatRatio(value: number | null): string {
  return value === null ? NO_DATA : `${ratio.format(value)}倍`;
}

// 距離（m）。1km 以上は「1.2km」、未満は「150m」。
export function formatDistance(meters: number | null): string {
  if (meters === null) return NO_DATA;
  return meters >= 1000 ? `${decimal.format(meters / 1000)}km` : `${integer.format(meters)}m`;
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

// 元データの時点。期間は「2025年7月〜2026年6月」、時点は「2026年1月1日時点」、年は「2023年」。
export function formatDataPeriod(period: {
  from: string | null;
  to: string;
  precision: "quarter" | "day" | "year";
}): string {
  const [ty, tm] = period.to.split("-").map(Number);
  switch (period.precision) {
    case "quarter": {
      const to = `${ty}年${tm}月`;
      if (!period.from) return `${to}まで`;
      const [fy, fm] = period.from.split("-").map(Number);
      return `${fy}年${fm}月〜${to}`;
    }
    case "day":
      return `${formatDate(period.to)}時点`;
    case "year":
      return `${ty}年`;
  }
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
    case "landUnitPrice":
      return formatManYenPerTsubo(value);
    case "landToOfficialRatio":
      return formatRatio(value);
    case "rentGap":
    case "landGap":
    case "momentumGap":
      return formatGap(value);
    default:
      return formatPercent(value);
  }
}
