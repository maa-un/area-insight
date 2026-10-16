import { CONDO_KIND_CONTRACT, type CondoFile, type CondoTrade } from "@area-insight/shared";
import { SQM_PER_TSUBO } from "@/lib/format";

// マンションの成約事例の絞り込みと集計。都道府県ごとのファイル（CondoFile）を画面で絞り込み、
// 駅ごとの坪単価の分布を出す。XPT001 は駅からの距離を返さないため、距離ではなく駅で絞る。

// 間取りのまとまり。部屋の数で分け、1 部屋だけは広さの違う「1R・1K」と「1DK・1LDK」を分ける。
export const PLAN_GROUPS = {
  "1K": "ワンルーム・1K",
  "1LDK": "1DK・1LDK",
  "2LDK": "2K〜2LDK",
  "3LDK": "3K〜3LDK",
  "4LDK": "4部屋以上",
  other: "その他",
} as const;
export type PlanGroup = keyof typeof PLAN_GROUPS;

// 「3LDK」「2LDK+S」「1R」→ まとまり。「オープンフロア」「スタジオ」や空は「その他」。
export function planGroup(plan: string): PlanGroup {
  const match = /^(\d+)\s*(S?L?D?K|R)/.exec(plan);
  if (!match) return "other";
  const rooms = Number(match[1]);
  if (rooms <= 0) return "other";
  if (rooms === 1) return match[2] === "R" || match[2] === "K" ? "1K" : "1LDK";
  if (rooms === 2) return "2LDK";
  if (rooms === 3) return "3LDK";
  return "4LDK";
}

export const PERIOD_YEARS = [1, 3, 5] as const;
export type PeriodYears = (typeof PERIOD_YEARS)[number];

export const KINDS = { all: "すべて", contract: "成約価格", transaction: "取引価格" } as const;
export type KindFilter = keyof typeof KINDS;

export type CondoFilters = {
  years: PeriodYears;
  kind: KindFilter;
  plans: PlanGroup[]; // 空ならすべて
  areaMin: number | null; // 専有面積（㎡）
  areaMax: number | null;
  ageMin: number | null; // 取引した時点の築年数（年）
  ageMax: number | null;
  // 「関係者間取引」「調停・競売等」など、事情のある取引も含めるか（相場から外れやすいため既定は除く）
  includeSpecial: boolean;
};

export const DEFAULT_FILTERS: CondoFilters = {
  years: 5,
  kind: "all",
  plans: [],
  areaMin: null,
  areaMax: null,
  ageMin: null,
  ageMax: null,
  includeSpecial: false,
};

// 画面で扱う取引 1 件。配列の形（CondoTrade）を名前付きに直し、坪単価と築年数を付ける。
export type Trade = {
  id: number; // ファイルの中での並び（一覧のキー）
  station: number;
  period: string;
  price: number; // 万円
  area: number; // ㎡
  plan: string;
  planGroup: PlanGroup;
  buildingYear: number | null;
  age: number | null; // 取引した時点の築年数。建築年が分からなければ null
  contract: boolean;
  renovated: boolean | null;
  district: string;
  structure: string;
  remarks: string;
  perSqm: number; // 円/㎡（坪単価は画面で換算する）
};

export function toTrade(row: CondoTrade, id = 0): Trade {
  const [station, period, price, area, plan, buildingYear, kind, renovated] = row;
  const year = Number(period.slice(0, 4));
  return {
    id,
    station,
    period,
    price,
    area,
    plan,
    planGroup: planGroup(plan),
    buildingYear,
    age: buildingYear === null ? null : Math.max(0, year - buildingYear),
    contract: kind === CONDO_KIND_CONTRACT,
    renovated: renovated === null ? null : renovated === 1,
    district: row[8],
    structure: row[9],
    remarks: row[10],
    perSqm: (price * 10000) / area,
  };
}

// 「2025Q2」→ 通し番号（四半期の比較に使う）
const quarterIndex = (period: string) =>
  Number(period.slice(0, 4)) * 4 + Number(period.slice(5)) - 1;

// ファイルの中で最も新しい四半期。取引が無ければ null
export function latestPeriod(trades: readonly Trade[]): string | null {
  let latest: string | null = null;
  for (const t of trades) if (latest === null || t.period > latest) latest = t.period;
  return latest;
}

export function matches(trade: Trade, filters: CondoFilters, latest: string): boolean {
  if (quarterIndex(trade.period) <= quarterIndex(latest) - filters.years * 4) return false;
  if (filters.kind === "contract" && !trade.contract) return false;
  if (filters.kind === "transaction" && trade.contract) return false;
  if (filters.plans.length > 0 && !filters.plans.includes(trade.planGroup)) return false;
  if (filters.areaMin !== null && trade.area < filters.areaMin) return false;
  if (filters.areaMax !== null && trade.area > filters.areaMax) return false;
  // 築年数で絞るときは、建築年の分からない取引を外す
  if ((filters.ageMin !== null || filters.ageMax !== null) && trade.age === null) return false;
  if (filters.ageMin !== null && (trade.age ?? 0) < filters.ageMin) return false;
  if (filters.ageMax !== null && (trade.age ?? 0) > filters.ageMax) return false;
  if (!filters.includeSpecial && trade.remarks !== "") return false;
  return true;
}

export function filterTrades(trades: readonly Trade[], filters: CondoFilters): Trade[] {
  const latest = latestPeriod(trades);
  return latest === null ? [] : trades.filter((t) => matches(t, filters, latest));
}

// 並べた値の p（0〜1）の位置。間は線形に補う（BigQuery の APPROX_QUANTILES に近い値になる）。
export function quantile(sorted: readonly number[], p: number): number | null {
  if (sorted.length === 0) return null;
  const position = (sorted.length - 1) * p;
  const lower = Math.floor(position);
  const upper = Math.ceil(position);
  const a = sorted[lower] ?? 0;
  const b = sorted[upper] ?? a;
  return a + (b - a) * (position - lower);
}

// 坪単価の 25%・50%・75% 点（円/㎡）と、価格・面積の中央値。25%〜75% を「よくある範囲」として示し、
// 仕入れでは 25% 点（安い方から 4 分の 1）を目安にする。
export type Summary = {
  count: number;
  contractCount: number;
  low: number;
  median: number;
  high: number;
  medianPrice: number; // 万円
  medianArea: number; // ㎡
};

export function summarize(trades: readonly Trade[]): Summary | null {
  if (trades.length === 0) return null;
  const sorted = (pick: (t: Trade) => number) => trades.map(pick).sort((a, b) => a - b);
  const unit = sorted((t) => t.perSqm);
  return {
    count: trades.length,
    contractCount: trades.filter((t) => t.contract).length,
    low: quantile(unit, 0.25) ?? 0,
    median: quantile(unit, 0.5) ?? 0,
    high: quantile(unit, 0.75) ?? 0,
    medianPrice:
      quantile(
        sorted((t) => t.price),
        0.5,
      ) ?? 0,
    medianArea:
      quantile(
        sorted((t) => t.area),
        0.5,
      ) ?? 0,
  };
}

// 駅（stations の添字）ごとの集計。取引の無い駅は含めない。
export function summarizeByStation(trades: readonly Trade[]): Map<number, Summary> {
  const groups = new Map<number, Trade[]>();
  for (const t of trades) {
    const list = groups.get(t.station);
    if (list) list.push(t);
    else groups.set(t.station, [t]);
  }
  const out = new Map<number, Summary>();
  for (const [station, list] of groups) {
    const summary = summarize(list);
    if (summary) out.set(station, summary);
  }
  return out;
}

// 専有面積から見た価格の目安（万円）。坪単価の分布（円/㎡）に面積を掛ける。
export function priceFor(perSqm: number, area: number): number {
  return (perSqm * area) / 10000;
}

// 坪単価（万円/坪）。並べ替えや色分けに使う
export const perTsubo = (perSqm: number) => (perSqm * SQM_PER_TSUBO) / 10000;

export function stationLabel(station: CondoFile["stations"][number]): string {
  if (station.name) return `${station.name}駅`;
  return station.cityName ? `${station.cityName}の駅` : "駅名不明";
}

// 絞り込みの URL のクエリ（共有できるようにする）。既定の値は書かない。
export function filtersFromParams(params: URLSearchParams): CondoFilters {
  const number = (key: string) => {
    const value = params.get(key);
    if (value === null || value === "") return null;
    const n = Number(value);
    return Number.isFinite(n) && n >= 0 ? n : null;
  };
  const years = Number(params.get("years"));
  const kind = params.get("kind");
  return {
    years: (PERIOD_YEARS as readonly number[]).includes(years)
      ? (years as PeriodYears)
      : DEFAULT_FILTERS.years,
    kind: kind !== null && Object.hasOwn(KINDS, kind) ? (kind as KindFilter) : "all",
    plans: (params.get("plans") ?? "")
      .split(",")
      .filter((p): p is PlanGroup => Object.hasOwn(PLAN_GROUPS, p)),
    areaMin: number("amin"),
    areaMax: number("amax"),
    ageMin: number("agemin"),
    ageMax: number("agemax"),
    includeSpecial: params.get("special") === "1",
  };
}

export function filtersToParams(filters: CondoFilters): Record<string, string | undefined> {
  const text = (value: number | null) => (value === null ? undefined : String(value));
  return {
    years: filters.years === DEFAULT_FILTERS.years ? undefined : String(filters.years),
    kind: filters.kind === "all" ? undefined : filters.kind,
    plans: filters.plans.length ? filters.plans.join(",") : undefined,
    amin: text(filters.areaMin),
    amax: text(filters.areaMax),
    agemin: text(filters.ageMin),
    agemax: text(filters.ageMax),
    special: filters.includeSpecial ? "1" : undefined,
  };
}
