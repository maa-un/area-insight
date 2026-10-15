import {
  type AreaMetrics,
  AreaMetricsFile,
  LandPricePoints,
  type MunicipalityCode,
  StationMetricsList,
} from "@area-insight/shared";
import { sampleLandPrices, sampleMetrics, sampleStations } from "./sample";

// 画面が使うデータの入口。今はサンプルデータを返す。集計ジョブの書き出しができたら、
// ビルド時にデータ用バケットから取ったファイルをここで読み込むように差し替える。
// どちらの場合も同じ zod スキーマで検証し、形が違えばビルドを失敗させる。
export const dataset = AreaMetricsFile.parse(sampleMetrics);
export const landPrices = LandPricePoints.parse(sampleLandPrices);
export const stations = StationMetricsList.parse(sampleStations);

const byCode = new Map(dataset.areas.map((area) => [area.code, area]));

export function findArea(code: MunicipalityCode): AreaMetrics | undefined {
  return byCode.get(code);
}

// 並べ替えに使える指標。better は「どちらが探す人にとって良い値か」で、比較画面の強調に使う。
export const METRICS = {
  tradePrice: { label: "取引価格（中央値）", unit: "万円", better: "low" },
  grossYield: { label: "想定表面利回り", unit: "%", better: "high" },
  vacancyRate: { label: "空き家率", unit: "%", better: "low" },
  populationChangeRate: { label: "人口増減率（5年）", unit: "%", better: "high" },
  population: { label: "人口", unit: "人", better: "high" },
} as const satisfies Record<string, { label: string; unit: string; better: "low" | "high" }>;
export type MetricKey = keyof typeof METRICS;

export function isMetricKey(value: string | null): value is MetricKey {
  return value !== null && Object.hasOwn(METRICS, value);
}

// 値の無い市区町村は並べ替えの後ろへ回す。
export function sortAreas(areas: AreaMetrics[], key: MetricKey, order: "asc" | "desc") {
  return [...areas].sort((a, b) => {
    const x = a[key];
    const y = b[key];
    if (x === null) return y === null ? 0 : 1;
    if (y === null) return -1;
    return order === "asc" ? x - y : y - x;
  });
}

// 同じ都道府県内での順位（1 始まり）と母数。値が無ければ undefined。
export function prefectureRank(area: AreaMetrics, key: MetricKey) {
  if (area[key] === null) return undefined;
  const order = METRICS[key].better === "low" ? "asc" : "desc";
  const peers = sortAreas(
    dataset.areas.filter((a) => a.prefectureCode === area.prefectureCode && a[key] !== null),
    key,
    order,
  );
  return { rank: peers.findIndex((a) => a.code === area.code) + 1, total: peers.length };
}

// 代表点が近い順の市区町村。
export function nearbyAreas(area: AreaMetrics, limit = 4): AreaMetrics[] {
  const [lng, lat] = area.center;
  const distance = (other: AreaMetrics) => {
    const dx = (other.center[0] - lng) * Math.cos((lat * Math.PI) / 180);
    const dy = other.center[1] - lat;
    return dx * dx + dy * dy;
  };
  return dataset.areas
    .filter((a) => a.code !== area.code)
    .sort((a, b) => distance(a) - distance(b))
    .slice(0, limit);
}
