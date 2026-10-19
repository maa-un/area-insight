import {
  type AreaMetrics,
  AreaMetricsFile,
  LandPricePoints,
  type MunicipalityCode,
  RELIABLE_TRADE_COUNT,
  StationMetricsList,
} from "@area-insight/shared";
import {
  formatDataPeriod,
  formatLandPriceAsOf,
  formatPopulationChange,
  formatSurveyChange,
  STALE_NOTE,
  STALE_YEARS,
  yearsApart,
} from "@/lib/period";
import { sampleLandPrices, sampleMetrics, sampleStations } from "./sample";

// 画面が使うデータの入口。ビルド前に scripts/prepare-data.mjs が集計ジョブの書き出しを
// src/data/generated/ に置いていればそれを使い、無ければサンプルデータを使う。
// どちらの場合も同じ zod スキーマで検証し、形が違えばビルドを失敗させる。
const generated = import.meta.glob<unknown>("./generated/*.json", {
  eager: true,
  import: "default",
});

export const dataset = AreaMetricsFile.parse(
  generated["./generated/metrics.json"] ?? sampleMetrics,
);
export const landPrices = LandPricePoints.parse(
  generated["./generated/land-prices.json"] ?? sampleLandPrices,
);
export const stations = StationMetricsList.parse(
  generated["./generated/stations.json"] ?? sampleStations,
);

const byCode = new Map(dataset.areas.map((area) => [area.code, area]));

export function findArea(code: MunicipalityCode): AreaMetrics | undefined {
  return byCode.get(code);
}

type MetricDefinition = {
  label: string;
  unit: string;
  // どちらが探す人にとって良い値か。比較画面の強調と、並べ替えの既定の向きに使う
  better: "low" | "high";
  // basic: 公的データを集計した指標。vacancy: 空き家の詳しい指標（ランキングの表には、選んだときだけ列を出す）。
  // distortion: 指標を組み合わせた市場の歪み（仕様書「市場の歪み指標」）
  group: "basic" | "vacancy" | "distortion";
};

// 並べ替え・比較・地図の塗り分けに使える指標。
export const METRICS = {
  tradePrice: {
    label: "取引価格（中央値）",
    unit: "万円",
    better: "low",
    group: "basic",
  },
  grossYield: {
    label: "想定表面利回り",
    unit: "%",
    better: "high",
    group: "basic",
  },
  vacancyRate: {
    label: "空き家率",
    unit: "%",
    better: "low",
    group: "basic",
  },
  otherVacancyRate: {
    label: "放置空き家率",
    unit: "%",
    better: "low",
    group: "vacancy",
  },
  vacancyRateChange: {
    label: "空き家率の増減（5年）",
    unit: "pt",
    better: "low",
    group: "vacancy",
  },
  populationChangeRate: {
    label: "人口増減率（5年）",
    unit: "%",
    better: "high",
    group: "basic",
  },
  population: {
    label: "人口",
    unit: "人",
    better: "high",
    group: "basic",
  },
  landUnitPrice: {
    label: "土地の坪単価（中央値）",
    unit: "万円/坪",
    better: "low",
    group: "basic",
  },
  landToOfficialRatio: {
    label: "取引 ÷ 公示地価",
    unit: "倍",
    better: "low",
    group: "distortion",
  },
  rentGap: {
    label: "人口の割に家賃が低い",
    unit: "pt",
    better: "high",
    group: "distortion",
  },
  landGap: {
    label: "人口の割に土地が安い",
    unit: "pt",
    better: "high",
    group: "distortion",
  },
  projectedChangeRate: {
    label: "将来人口の増減率（2020→2050年）",
    unit: "%",
    better: "high",
    group: "basic",
  },
  momentumGap: {
    label: "地価の上昇に取引が追いつかない",
    unit: "pt",
    better: "high",
    group: "distortion",
  },
} as const satisfies Record<string, MetricDefinition>;
export type MetricKey = keyof typeof METRICS;

export const BASIC_METRICS = (Object.keys(METRICS) as MetricKey[]).filter(
  (key) => METRICS[key].group === "basic",
);
export const VACANCY_METRICS = (Object.keys(METRICS) as MetricKey[]).filter(
  (key) => METRICS[key].group === "vacancy",
);
export const DISTORTION_METRICS = (Object.keys(METRICS) as MetricKey[]).filter(
  (key) => METRICS[key].group === "distortion",
);

export function isDistortionMetric(key: MetricKey): boolean {
  return METRICS[key].group === "distortion";
}

// 指標の時点。すべての数字のそばに短く出す（仕様書「時点の表示ルール」）。
// 利回りは家賃（調査年）と取引（期間）の組み合わせなので、根拠の両方を並べる。
// 歪みは需要と価格の指標の組み合わせなので、根拠の時点をそれぞれ並べる。
export function metricPeriod(key: MetricKey): string {
  const { tradePrice, vacancyRate, monthlyRent, population, landTrade } = dataset.sources;
  const landPrice = formatLandPriceAsOf(dataset.sources);
  switch (key) {
    case "tradePrice":
      return formatDataPeriod(tradePrice);
    case "grossYield":
      return `家賃 ${formatDataPeriod(monthlyRent)}・取引 ${formatDataPeriod(tradePrice)}`;
    case "vacancyRate":
    case "otherVacancyRate":
      return formatDataPeriod(vacancyRate);
    case "vacancyRateChange":
      return formatSurveyChange(dataset.sources.vacancyRateChange);
    case "populationChangeRate":
      return formatPopulationChange(population);
    case "population":
      return formatDataPeriod(population);
    case "projectedChangeRate":
      return formatDataPeriod(dataset.sources.populationProjection);
    case "landUnitPrice":
      return formatDataPeriod(landTrade);
    case "landToOfficialRatio":
      return `${formatDataPeriod(landTrade)}・${landPrice}`;
    case "rentGap":
      return `人口 ${formatPopulationChange(population)}・家賃 ${formatDataPeriod(monthlyRent)}`;
    case "landGap":
      return `人口 ${formatPopulationChange(population)}・土地 ${formatDataPeriod(landTrade)}`;
    case "momentumGap":
      return `${landPrice}・土地 ${formatDataPeriod(landTrade)}`;
  }
}

// 組み合わせた指標の根拠の時点が 2 年以上離れていれば注記する（利回り、家賃の歪み）。
export function metricPeriodNote(key: MetricKey): string | null {
  const { monthlyRent, population } = dataset.sources;
  if (key === "grossYield") return yieldPeriodNote();
  if (key === "rentGap" && yearsApart(population, monthlyRent) >= STALE_YEARS) {
    return "人口と家賃は時点がずれています";
  }
  return null;
}

// 利回りの根拠（家賃と取引価格）の時点が 2 年以上離れていれば注記する。
export function yieldPeriodNote(): string | null {
  const { tradePrice, monthlyRent } = dataset.sources;
  return yearsApart(monthlyRent, tradePrice) >= STALE_YEARS ? STALE_NOTE : null;
}

export function isMetricKey(value: string | null): value is MetricKey {
  return value !== null && Object.hasOwn(METRICS, value);
}

// 取引から出す指標と、その件数。件数が閾値（RELIABLE_TRADE_COUNT）未満の市区町村では値が振れるため「参考値」になる。
// 歪みの順位の差は、集計の時点で参考値を除いて出している（値が null になる）。
const TRADE_COUNTS: Partial<Record<MetricKey, "tradeCount" | "landTradeCount">> = {
  tradePrice: "tradeCount",
  grossYield: "tradeCount",
  landUnitPrice: "landTradeCount",
};

export function isTradeMetric(key: MetricKey): boolean {
  return TRADE_COUNTS[key] !== undefined;
}

export function isReferenceValue(area: AreaMetrics, key: MetricKey = "tradePrice"): boolean {
  const count = TRADE_COUNTS[key];
  return count !== undefined && area[count] < RELIABLE_TRADE_COUNT;
}

// ランキングに載せる市区町村。取引から出す指標では、既定で参考値の市区町村を外す
// （件数の少ない町村が利回りの上位を占めるのを防ぐ）。人口・空き家率は統計の値なので外さない。
// 歪みのランキングには「利回りは高いが需要が弱い」市区町村を載せない（歪みではなく需要の弱さとみなす）。
export function rankableAreas(
  areas: AreaMetrics[],
  key: MetricKey,
  includeReference: boolean,
): AreaMetrics[] {
  if (isDistortionMetric(key)) return areas.filter((area) => !area.weakDemand);
  if (includeReference || !isTradeMetric(key)) return areas;
  return areas.filter((area) => !isReferenceValue(area, key));
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
// 位置が分からない市区町村は、同じ都道府県の市区町村を返す。
export function nearbyAreas(area: AreaMetrics, limit = 4): AreaMetrics[] {
  const others = dataset.areas.filter((a) => a.code !== area.code);
  const center = area.center;
  if (!center)
    return others.filter((a) => a.prefectureCode === area.prefectureCode).slice(0, limit);
  const [lng, lat] = center;
  const distance = (other: AreaMetrics) => {
    if (!other.center) return Number.POSITIVE_INFINITY;
    const dx = (other.center[0] - lng) * Math.cos((lat * Math.PI) / 180);
    const dy = other.center[1] - lat;
    return dx * dx + dy * dy;
  };
  return others.sort((a, b) => distance(a) - distance(b)).slice(0, limit);
}
