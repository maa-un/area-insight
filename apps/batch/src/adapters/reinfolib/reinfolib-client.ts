import { z } from "zod";
import type {
  MunicipalityRecord,
  PointRecord,
  PublicDataSource,
  StationRecord,
  Tile,
  TransactionRecord,
} from "../../ports.js";
import type { Quarter } from "../../quarters.js";
import { type FetcherOptions, RateLimitedFetcher } from "../rate-limited-fetcher.js";

// 国土交通省 不動産情報ライブラリ API のクライアント。
// https://www.reinfolib.mlit.go.jp/help/apiManual/
const BASE_URL = "https://www.reinfolib.mlit.go.jp/ex-api/external";

const MunicipalityRow = z.looseObject({ id: z.string(), name: z.string() });

// 取引価格（XIT001）の 1 件。値はすべて文字列で返るため、加工せずそのまま保存する。
// 知らない項目が増えても失敗しないよう、定義していない項目は取り除く（保存するのは定義した項目だけ）。
const TransactionRow = z.object({
  Type: z.string().optional(),
  Region: z.string().optional(),
  MunicipalityCode: z.string().optional(),
  Prefecture: z.string().optional(),
  Municipality: z.string().optional(),
  DistrictName: z.string().optional(),
  TradePrice: z.string().optional(),
  PricePerUnit: z.string().optional(),
  FloorPlan: z.string().optional(),
  Area: z.string().optional(),
  UnitPrice: z.string().optional(),
  LandShape: z.string().optional(),
  Frontage: z.string().optional(),
  TotalFloorArea: z.string().optional(),
  BuildingYear: z.string().optional(),
  Structure: z.string().optional(),
  Use: z.string().optional(),
  Purpose: z.string().optional(),
  Direction: z.string().optional(),
  Classification: z.string().optional(),
  Breadth: z.string().optional(),
  CityPlanning: z.string().optional(),
  CoverageRatio: z.string().optional(),
  FloorAreaRatio: z.string().optional(),
  Period: z.string().optional(),
  Renovation: z.string().optional(),
  Remarks: z.string().optional(),
  PriceCategory: z.string().optional(),
  DistrictCode: z.string().optional(),
});

const Envelope = <T extends z.ZodType>(row: T) => z.looseObject({ data: z.array(row) });

// XPT001・XPT002 は GeoJSON の点で返る。属性は加工せずに保存するため、中身は検証しない。
const PointCollection = z.looseObject({
  features: z.array(
    z.looseObject({
      geometry: z.looseObject({
        type: z.literal("Point"),
        coordinates: z.tuple([z.number(), z.number()]).rest(z.number()),
      }),
      properties: z.record(z.string(), z.unknown()).nullable(),
    }),
  ),
});

// XKT015 は GeoJSON の線（駅のホームの区間）で返る。形と属性は加工せずに保存するため、中身は検証しない。
const FeatureCollection = z.looseObject({
  features: z.array(
    z.looseObject({
      geometry: z.looseObject({ type: z.string(), coordinates: z.array(z.unknown()) }),
      properties: z.record(z.string(), z.unknown()).nullable(),
    }),
  ),
});

export type ReinfolibClientOptions = FetcherOptions & { apiKey: string };

// 取得元（PublicDataSource）の実装。
export class ReinfolibClient implements PublicDataSource {
  private readonly fetcher: RateLimitedFetcher;

  constructor(private readonly options: ReinfolibClientOptions) {
    this.fetcher = new RateLimitedFetcher(options);
  }

  // XIT002: 都道府県内の市区町村一覧。
  async municipalities(prefectureCode: string): Promise<MunicipalityRecord[]> {
    const body = await this.get("XIT002", { area: prefectureCode });
    if (body === null) return [];
    return Envelope(MunicipalityRow)
      .parse(body)
      .data.map((row) => ({ code: row.id, name: row.name }));
  }

  // XIT001: 都道府県・四半期を指定した取引価格（成約価格は含めない）。
  async transactions(prefectureCode: string, quarter: Quarter): Promise<TransactionRecord[]> {
    const body = await this.get("XIT001", {
      year: String(quarter.year),
      quarter: String(quarter.quarter),
      area: prefectureCode,
      priceClassification: "01",
    });
    return body === null ? [] : Envelope(TransactionRow).parse(body).data;
  }

  // XPT002: 地価公示・地価調査の地点。用途は絞らず全用途を取る。
  async landPrices(tile: Tile, year: number, classification: "0" | "1"): Promise<PointRecord[]> {
    return this.points("XPT002", tile, {
      year: String(year),
      priceClassification: classification,
    });
  }

  // XPT001: 「土地」（landTypeCode 01）と「土地と建物」（02）の取引価格。位置は物件の最寄り駅。
  async stationTransactions(tile: Tile, from: Quarter, to: Quarter): Promise<PointRecord[]> {
    return this.points("XPT001", tile, {
      from: `${from.year}${from.quarter}`,
      to: `${to.year}${to.quarter}`,
      landTypeCode: "01,02",
      priceClassification: "01",
    });
  }

  // XPT001: 「中古マンション等」（landTypeCode 07）の取引。位置は物件の最寄り駅。
  // 成約事例として使うため、取引価格（アンケート）と成約価格（レインズ）の両方を取る（priceClassification を付けない）。
  async condoTransactions(tile: Tile, from: Quarter, to: Quarter): Promise<PointRecord[]> {
    return this.points("XPT001", tile, {
      from: `${from.year}${from.quarter}`,
      to: `${to.year}${to.quarter}`,
      landTypeCode: "07",
    });
  }

  // XKT015: 国土数値情報（駅別乗降客数）。駅名・路線名・運営会社と、駅の位置（線）を持つ。
  async stations(tile: Tile): Promise<StationRecord[]> {
    const body = await this.tile("XKT015", tile, {});
    if (body === null) return [];
    return FeatureCollection.parse(body).features.map((feature) => ({
      geometry: feature.geometry,
      properties: feature.properties ?? {},
    }));
  }

  private async points(
    api: string,
    tile: Tile,
    params: Record<string, string>,
  ): Promise<PointRecord[]> {
    const body = await this.tile(api, tile, params);
    if (body === null) return [];
    return PointCollection.parse(body).features.map((feature) => ({
      coordinates: [feature.geometry.coordinates[0], feature.geometry.coordinates[1]],
      properties: feature.properties ?? {},
    }));
  }

  // データが無いタイルは空の配列（または 404）で返る。どちらも null にそろえる。
  private async tile(api: string, tile: Tile, params: Record<string, string>): Promise<unknown> {
    const body = await this.get(api, {
      response_format: "geojson",
      z: String(tile.z),
      x: String(tile.x),
      y: String(tile.y),
      ...params,
    });
    return body === null || (Array.isArray(body) && body.length === 0) ? null : body;
  }

  private get(api: string, params: Record<string, string>): Promise<unknown> {
    return this.fetcher.getJson(api, `${BASE_URL}/${api}?${new URLSearchParams(params)}`, {
      "Ocp-Apim-Subscription-Key": this.options.apiKey,
    });
  }
}
