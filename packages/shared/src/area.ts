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

// 市場の歪みの値（順位の差、-100〜100）。
export const DistortionGap = z.number().min(-100).max(100);
// 「歪みあり」とする順位の差（仕様書の推奨値。実データの分布を見て確定する）。
export const DISTORTION_THRESHOLD = 40;

// 指標ごとの元データの時点。期間のデータ（取引）は from〜to、時点のデータ（地価、統計）は to だけを持つ。
//   quarter: 四半期の範囲（from は最初の四半期の初日、to は最後の四半期の末日）
//   day: その日の時点（公示地価は 1 月 1 日、基準地価は 7 月 1 日）
//   year: その年の値（統計。調査日は統計ごとに違うため年だけ示す）
export const DataPeriod = z.object({
  source: z.string().min(1), // 画面に出す出典の名前
  from: z.iso.date().nullable(),
  to: z.iso.date(),
  precision: z.enum(["quarter", "day", "year"]),
});
export type DataPeriod = z.infer<typeof DataPeriod>;

export const DATA_PERIOD_KEYS = [
  "trade", // 中古戸建の取引（直近 4 四半期）
  "landTrade", // 土地の取引（直近 8 四半期）
  "officialLandPrice", // 地価公示
  "prefectureLandPrice", // 都道府県地価調査（基準地価）
  "vacancy", // 空き家率
  "rent", // 家賃
  "population", // 人口
  "stationTrade", // 駅ごとの取引（土地と建物）
  "stationLandTrade", // 駅ごとの土地の取引
] as const;
export const DataPeriodKey = z.enum(DATA_PERIOD_KEYS);
export type DataPeriodKey = z.infer<typeof DataPeriodKey>;

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
  // 民営借家の 1㎡あたり家賃（円/月）。家賃相場の元で、歪みの比較に使う
  rentPerSqm: z.number().nonnegative().nullable(),
  // 土地（宅地(土地)）の取引単価の中央値（円/㎡）と件数。期間は直近 8 四半期
  landUnitPrice: z.number().nonnegative().nullable(),
  landTradeCount: z.number().int().nonnegative(),
  // 土地の取引単価の前年比（%）。直近 4 四半期と、その前の 4 四半期の中央値を比べる。どちらかの件数が少なければ null
  landPriceChangeRate: z.number().nullable(),
  // 住宅地の地価（公示地価・基準地価の最新年の地点の中央値、円/㎡）と前年比（%、地点の前年比の中央値）
  officialLandPrice: z.number().nonnegative().nullable(),
  officialLandPriceChangeRate: z.number().nullable(),
  // 土地の取引単価 ÷ 住宅地の地価。1 を下回るほど公的な評価より安く取引されている。土地の取引が少なければ null
  landToOfficialRatio: z.number().nonnegative().nullable(),
  // 市場の歪み（同じ都道府県の市区町村の中での「需要の指標の順位 − 価格の指標の順位」、-100〜100）。
  // 正の値が大きいほど、需要の割に価格が低い。仕様書「市場の歪み指標」
  //   rentGap: 人口の 5 年増減率 と 1㎡あたり家賃
  //   landGap: 人口の 5 年増減率 と 土地の取引単価
  //   momentumGap: 住宅地の地価の前年比 と 土地の取引単価の前年比
  rentGap: DistortionGap.nullable(),
  landGap: DistortionGap.nullable(),
  momentumGap: DistortionGap.nullable(),
  // 「利回りは高いが需要が弱い」（都道府県内で利回りが上位 2 割・人口が減少・空き家率が上位 2 割）。
  // 歪みではなく、需要の弱さが価格に出ているだけとみなす
  weakDemand: z.boolean(),
  // 市区町村を指す位置（代表点）。境界の最大の面の重心。位置の分かるデータが無い市区町村は null
  center: LngLat.nullable(),
});
export type AreaMetrics = z.infer<typeof AreaMetrics>;

export const AreaMetricsFile = z.object({
  // データを更新した日（集計ジョブを動かした日）。各指標の元データの時点は periods に持つ
  updatedAt: z.iso.date(),
  periods: z.partialRecord(DataPeriodKey, DataPeriod),
  sample: z.boolean(),
  areas: z.array(AreaMetrics),
});
export type AreaMetricsFile = z.infer<typeof AreaMetricsFile>;

// 土地（宅地(土地)）の取引単価（円/㎡）の分布。0%〜100% を 5% 刻みで 21 個持ち（BigQuery の APPROX_QUANTILES(x, 20)）、
// 画面で「この単価は地区の下位何%か」を出す。中央値は 11 番目（添字 10）。
export const LAND_QUANTILE_STEPS = 20;
export const LandPriceStats = z.object({
  count: z.number().int().positive(),
  quantiles: z.array(z.number().nonnegative()).length(LAND_QUANTILE_STEPS + 1),
  medianArea: z.number().nonnegative().nullable(), // 取引された土地の面積の中央値（㎡）
});
export type LandPriceStats = z.infer<typeof LandPriceStats>;

// 駅からの距離の区分。徒歩 1 分 = 80m（不動産の表示規約）として、10 分以内（800m）・20 分以内（1,600m）・それ以上。
export const STATION_DISTANCE_BANDS = ["within10", "within20", "over20"] as const;
export const StationDistanceBand = z.enum(STATION_DISTANCE_BANDS);
export type StationDistanceBand = z.infer<typeof StationDistanceBand>;
export const METERS_PER_WALK_MINUTE = 80;

// 地点の中央値と地点数。
const LandPriceMedian = z.object({
  price: z.number().nonnegative(), // 円/㎡
  count: z.number().int().positive(),
});

// 市区町村の住宅地の地価（公示地価・地価調査の最新年の地点から）。取引単価と比べる基準。
export const OfficialLandPrices = z.object({
  // 住宅地の地点の中央値。住宅地の地点が無ければ null
  residential: LandPriceMedian.nullable(),
  // 駅からの距離別の住宅地の地価（近い順）。距離の分かる地点が無い区分は含まない
  byStationDistance: z.array(LandPriceMedian.extend({ band: StationDistanceBand })),
});
export type OfficialLandPrices = z.infer<typeof OfficialLandPrices>;

// 駅ごとの土地の坪単価の目安（仕様書「駅ごとの妥当な土地の坪単価」）。
// XPT001 の土地（宅地(土地)）の取引の㎡単価を、住宅地の地価の前年比で adjustedTo の時点に補正し、
// 25%・50%・75% 点を出す。25%〜75% を「妥当な範囲」とする。XPT001 は駅からの距離を返さないため、
// 距離別には、同じ駅が最寄りの公示地価・基準地価（住宅地）の中央値を並べる。
export const StationLandPrice = z.object({
  stationName: z.string(),
  lineNames: z.array(z.string()),
  coordinates: LngLat,
  // 取引された土地のある市区町村（市区町村ページでの絞り込みに使う）
  cityCodes: z.array(MunicipalityCode),
  count: z.number().int().positive(),
  low: z.number().nonnegative(), // 25% 点（円/㎡）
  median: z.number().nonnegative(), // 50% 点（円/㎡）
  high: z.number().nonnegative(), // 75% 点（円/㎡）
  periodFrom: QuarterLabel,
  periodTo: QuarterLabel,
  adjustedTo: z.iso.date().nullable(), // 補正先の時点。地価が無く補正していなければ null
  officialByStationDistance: z.array(LandPriceMedian.extend({ band: StationDistanceBand })),
});
export type StationLandPrice = z.infer<typeof StationLandPrice>;

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
  // 土地の取引単価。市区町村全体と、地区（大字・町名）ごと。期間は直近 8 四半期
  landPrices: z.object({
    periodFrom: QuarterLabel.nullable(),
    periodTo: QuarterLabel.nullable(),
    total: LandPriceStats.nullable(),
    districts: z.array(LandPriceStats.extend({ district: z.string() })),
  }),
  officialLandPrices: OfficialLandPrices,
  // この市区町村で取引された土地の、最寄り駅ごとの坪単価の目安（取引の多い順）
  stationLandPrices: z.array(StationLandPrice),
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

// 地価公示・地価調査の地点（XPT002）。種類ごとに最新の年の地点。都道府県ごとのファイル。
// 地価の種類。地価公示（1 月 1 日時点）と都道府県地価調査（基準地価、7 月 1 日時点）は時点が半年ずれるため分けて示す。
export const LandPriceKind = z.enum(["official", "prefecture"]);
export type LandPriceKind = z.infer<typeof LandPriceKind>;

export const LandPricePoint = z.object({
  pointId: z.string().min(1),
  kind: LandPriceKind,
  asOf: z.iso.date(), // 価格の時点
  coordinates: LngLat,
  price: z.number().nonnegative(), // 円/㎡
  changeRate: z.number().nullable(), // 前年比（%）
  use: z.string(),
  location: z.string(),
  stationName: z.string().nullable(), // 最寄り駅名
  stationDistance: z.number().nonnegative().nullable(), // 最寄り駅までの道路距離（m）
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
