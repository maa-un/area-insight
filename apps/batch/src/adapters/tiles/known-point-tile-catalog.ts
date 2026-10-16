import type { Tile, TileCatalog } from "../../ports.js";
import { tileOf, uniqueTiles } from "./tile-math.js";

// これまでに取得した地点の位置（経度・緯度）を返すもの。実装は BigQuery（raw_land_prices）。
export type KnownPoints = () => Promise<readonly (readonly [number, number])[]>;

// 地価の地点があったタイルだけを返す一覧。全国の陸地タイル（約 2.9 万枚）の多くは地点が無いため、
// 地点のあったタイルに絞ってリクエスト数と時間を減らす。
// これまでの取得結果が無いとき（初回）は、全国の一覧（fallback）を使う。
// 新しく追加された地点は、既存の地点の無いタイルにあると取りこぼす。数年に 1 回は全国の一覧で取り直す。
export class KnownPointTileCatalog implements TileCatalog {
  constructor(
    private readonly knownPoints: KnownPoints,
    private readonly fallback: TileCatalog,
  ) {}

  async tiles(zoom: number): Promise<Tile[]> {
    const points = await this.knownPoints();
    if (points.length === 0) return this.fallback.tiles(zoom);
    return uniqueTiles(points.map(([longitude, latitude]) => tileOf(longitude, latitude, zoom)));
  }
}
