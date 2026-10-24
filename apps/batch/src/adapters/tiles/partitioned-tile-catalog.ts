import type { Tile, TileCatalog } from "../../ports.js";

// 同じ固定一覧を分割する。別ジョブでも一覧の変化でタイルが抜けないよう、FileTileCatalog と使う。
export class PartitionedTileCatalog implements TileCatalog {
  constructor(
    private readonly source: TileCatalog,
    private readonly part: number,
    private readonly parts: number,
  ) {
    if (
      !Number.isInteger(parts) ||
      parts < 1 ||
      parts > 64 ||
      !Number.isInteger(part) ||
      part < 0 ||
      part >= parts
    ) {
      throw new Error("invalid tile partition");
    }
  }

  async tiles(zoom: number): Promise<Tile[]> {
    return (await this.source.tiles(zoom)).filter((_, index) => index % this.parts === this.part);
  }
}
