// 地図の色分け。値を 5 段階（分位）に分け、凡例と地図で同じ区切りを使う。
// ブランドの配色に合わせ、淡いクリームから濃いテラコッタへ。
export const SCALE_COLORS = ["#f1e2d2", "#e2b59a", "#d08a62", "#c4582c", "#8f3c1c"] as const;
export const NO_DATA_COLOR = "#d9d0c0";
// 駅ごとの取引相場の点。濃インクにクリームの縁
export const STATION_COLOR = "#26201a";

export type Scale = { breaks: number[]; colorOf: (value: number | null) => string };

export function quantileScale(values: (number | null)[]): Scale {
  const sorted = values.filter((v): v is number => v !== null).sort((a, b) => a - b);
  const breaks = [1, 2, 3, 4].map((i) => sorted[Math.floor((sorted.length * i) / 5)] ?? 0);
  return {
    breaks,
    colorOf: (value) => {
      if (value === null) return NO_DATA_COLOR;
      const bin = breaks.findIndex((b) => value < b);
      return SCALE_COLORS[bin === -1 ? SCALE_COLORS.length - 1 : bin] ?? NO_DATA_COLOR;
    },
  };
}
