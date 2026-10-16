import { LAND_QUANTILE_STEPS, type LandPriceStats } from "@area-insight/shared";

// 土地の取引単価の分布（5% 刻みの分位）から、ある単価がどの位置にあるかを出す。

export function medianOf(stats: LandPriceStats): number {
  return stats.quantiles[LAND_QUANTILE_STEPS / 2] ?? 0;
}

export function quartilesOf(stats: LandPriceStats): { p25: number; p75: number } {
  return {
    p25: stats.quantiles[LAND_QUANTILE_STEPS / 4] ?? 0,
    p75: stats.quantiles[(LAND_QUANTILE_STEPS * 3) / 4] ?? 0,
  };
}

// 単価が分布の下から何% の位置にあるか（0〜100）。分位の間は直線で補間する。
export function percentileOf(stats: LandPriceStats, unitPrice: number): number {
  const q = stats.quantiles;
  const first = q[0] ?? 0;
  const last = q[q.length - 1] ?? 0;
  if (unitPrice <= first) return 0;
  if (unitPrice >= last) return 100;
  const step = 100 / (q.length - 1);
  for (let i = 0; i < q.length - 1; i++) {
    const lo = q[i] ?? 0;
    const hi = q[i + 1] ?? 0;
    if (unitPrice >= lo && unitPrice < hi) {
      const within = hi === lo ? 0 : (unitPrice - lo) / (hi - lo);
      return (i + within) * step;
    }
  }
  return 100;
}

export type Verdict = {
  label: string;
  tone: "low" | "mid" | "high";
};

// 位置から一言の判定にする。中央 20%（40〜60%）を「相場並み」とする。
export function verdictOf(percentile: number): Verdict {
  if (percentile < 20) return { label: "かなり安い", tone: "low" };
  if (percentile < 40) return { label: "安め", tone: "low" };
  if (percentile <= 60) return { label: "相場並み", tone: "mid" };
  if (percentile <= 80) return { label: "高め", tone: "high" };
  return { label: "かなり高い", tone: "high" };
}

// 価格（万円）と面積（㎡）から ㎡単価（円/㎡）。
export function unitPriceOf(priceManYen: number, areaSqm: number): number | null {
  if (!(priceManYen > 0) || !(areaSqm > 0)) return null;
  return Math.round((priceManYen * 10000) / areaSqm);
}
