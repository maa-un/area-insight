import { z } from "zod";
import { MunicipalityCode, PrefectureCode } from "./municipality.js";

// 集計ジョブが書き出し、画面がビルド時に読み込むファイルの形。
// API キーが届くまでは画面側のサンプルデータが同じ形で代わりを務める（sample = true）。

// 経度・緯度の順（GeoJSON と同じ）。
export const LngLat = z.tuple([z.number().min(-180).max(180), z.number().min(-90).max(90)]);
export type LngLat = z.infer<typeof LngLat>;

// 取引時期。元データが四半期単位のため「2025Q2」の形で持つ。
export const QuarterLabel = z.string().regex(/^\d{4}Q[1-4]$/);

// 取引件数がこれ未満の値は「参考値」として表示する（仕様書の推奨値。実データの分布を見て確定する）。
export const RELIABLE_TRADE_COUNT = 10;

// 市区町村の指標一覧（全国 1 ファイル）の 1 行。値が無い指標は null。
export const AreaMetrics = z.object({
  code: MunicipalityCode,
  prefectureCode: PrefectureCode,
  name: z.string().min(1),
  // 直近 4 四半期の「宅地（土地と建物）」取引の取引価格の中央値（万円）と件数
  tradePrice: z.number().nonnegative().nullable(),
  tradeCount: z.number().int().nonnegative(),
  // 空き家数 ÷ 住宅総数（%）
  vacancyRate: z.number().min(0).max(100).nullable(),
  population: z.number().int().nonnegative().nullable(),
  // 過去 5 年の人口増減率（%）
  populationChangeRate: z.number().nullable(),
  // 想定表面利回り（%）。物件ごとではなくエリアの目安
  grossYield: z.number().nonnegative().nullable(),
  // 家賃相場（円/月）。PropFolio へ渡す
  monthlyRent: z.number().int().nonnegative().nullable(),
  // 市区町村を指す位置（代表点）。境界の最大の面の重心。位置の分かるデータが無い市区町村は null
  center: LngLat.nullable(),
});
export type AreaMetrics = z.infer<typeof AreaMetrics>;

export const AreaMetricsFile = z.object({
  asOf: z.iso.date(),
  sample: z.boolean(),
  areas: z.array(AreaMetrics),
});
export type AreaMetricsFile = z.infer<typeof AreaMetricsFile>;

// 市区町村の詳細（市区町村ごとのファイル）。
export const AreaDetail = z.object({
  code: MunicipalityCode,
  // 四半期ごとの取引価格の中央値（過去 5 年、古い順）
  quarters: z.array(
    z.object({
      period: QuarterLabel,
      price: z.number().nonnegative().nullable(),
      count: z.number().int().nonnegative(),
    }),
  ),
  // 年ごとの取引価格の中央値（古い順）。前年比は画面で計算する
  years: z.array(
    z.object({
      year: z.number().int(),
      price: z.number().nonnegative().nullable(),
      count: z.number().int().nonnegative(),
    }),
  ),
  // 年ごとの人口（古い順）
  populationHistory: z.array(
    z.object({ year: z.number().int(), population: z.number().int().nonnegative() }),
  ),
  // 直近の取引（新しい順）
  recentTransactions: z.array(
    z.object({
      period: QuarterLabel,
      district: z.string(),
      price: z.number().nonnegative(), // 万円
      landArea: z.number().nonnegative().nullable(), // ㎡
      floorArea: z.number().nonnegative().nullable(), // ㎡
      buildingYear: z.number().int().nullable(),
    }),
  ),
});
export type AreaDetail = z.infer<typeof AreaDetail>;

// 地価公示・地価調査の地点（XPT002）。都道府県ごとのファイル。
export const LandPricePoint = z.object({
  pointId: z.string().min(1),
  coordinates: LngLat,
  price: z.number().nonnegative(), // 円/㎡
  changeRate: z.number().nullable(), // 前年比（%）
  use: z.string(),
  location: z.string(),
});
export type LandPricePoint = z.infer<typeof LandPricePoint>;

// 駅ごとの取引相場（XPT001）。位置は物件の最寄り駅。
// 「土地と建物」の㎡単価が空のため、取引総額の中央値と件数を持つ。
// XPT001 は駅名を返さないため、駅名と路線名は集計で最寄りの駅（XKT015）から付ける。
export const StationMetrics = z.object({
  stationName: z.string().nullable(), // 近くに駅が見つからなければ null
  lineNames: z.array(z.string()), // 同じ名前の駅（運営会社をまたぐ）に通る路線
  cityName: z.string().nullable(), // 駅のある市区町村
  coordinates: LngLat,
  medianPrice: z.number().nonnegative(), // 取引総額の中央値（万円）
  count: z.number().int().nonnegative(),
});
export type StationMetrics = z.infer<typeof StationMetrics>;

export const LandPricePoints = z.array(LandPricePoint);
export const StationMetricsList = z.array(StationMetrics);

// 市区町村の境界（apps/batch/scripts/build-boundaries.mjs の出力）。地図のページだけが読み込む。
// 頂点は数十万あり、1 つずつ検証すると遅いため、座標の中身までは確かめない（MapLibre が描けない点は捨てる）。
export const Boundaries = z.object({
  type: z.literal("FeatureCollection"),
  features: z.array(
    z.object({
      type: z.literal("Feature"),
      properties: z.object({ code: MunicipalityCode, center: LngLat }),
      geometry: z.object({ type: z.literal("MultiPolygon"), coordinates: z.array(z.unknown()) }),
    }),
  ),
});
export type Boundaries = z.infer<typeof Boundaries>;
