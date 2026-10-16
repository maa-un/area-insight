// 地図の色分け。値を 5 段階（分位）に分け、凡例と地図で同じ区切りを使う。
// ブランドの差し色に合わせ、淡いピーチから濃いテラコッタへ。
export const SCALE_COLORS = ["#fbe8dc", "#f5bf9f", "#ea8f66", "#cf5d36", "#8c3519"] as const;
export const NO_DATA_COLOR = "#e4e0da";
// 駅ごとの取引相場の点。濃い墨色に白の縁
export const STATION_COLOR = "#292524";

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
