import { readFile } from "node:fs/promises";
import { z } from "zod";
import type { Tile, TileCatalog } from "../../ports.js";

// イメージに同梱したタイル一覧（tiles/z<ズーム>.json）を読む。
// 一覧は scripts/build-tiles.mjs で行政区域の境界データから作り、陸地を含むタイルだけを持つ。
const TileList = z.array(z.tuple([z.number().int(), z.number().int()]));

export class FileTileCatalog implements TileCatalog {
  constructor(private readonly directory: URL) {}

  async tiles(zoom: number): Promise<Tile[]> {
    const file = new URL(`z${zoom}.json`, this.directory);
    let text: string;
    try {
      text = await readFile(file, "utf8");
    } catch {
      throw new Error(`tile list for zoom ${zoom} is missing; run scripts/build-tiles.mjs first`);
    }
    return TileList.parse(JSON.parse(text)).map(([x, y]) => ({ z: zoom, x, y }));
  }
}
