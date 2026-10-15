// 地図の色分け。値を 5 段階（分位）に分け、凡例と地図で同じ区切りを使う。
export const SCALE_COLORS = ["#dbeafe", "#93c5fd", "#3b82f6", "#1d4ed8", "#1e3a8a"] as const;
export const NO_DATA_COLOR = "#d4d4d8";

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
