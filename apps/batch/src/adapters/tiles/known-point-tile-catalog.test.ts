import { describe, expect, it } from "vitest";
import type { Tile, TileCatalog } from "../../ports.js";
import { KnownPointTileCatalog } from "./known-point-tile-catalog.js";
import { tileOf } from "./tile-math.js";

const fallback: TileCatalog = { tiles: async (z) => [{ z, x: 0, y: 0 }] };

describe("tileOf", () => {
  it("uses the standard XYZ numbering", () => {
    expect(tileOf(0, 0, 1)).toEqual({ z: 1, x: 1, y: 1 });
    expect(tileOf(-179.9, 85, 1)).toEqual({ z: 1, x: 0, y: 0 });
    // 東京駅付近は z10 で 909/403
    expect(tileOf(139.767, 35.681, 10)).toEqual({ z: 10, x: 909, y: 403 });
  });
});

describe("KnownPointTileCatalog", () => {
  it("returns only the tiles that had points, without duplicates", async () => {
    const points: [number, number][] = [
      [137.95, 36.24],
      [137.9501, 36.2401], // 同じタイル
      [139.753, 35.694],
    ];
    const tiles = await new KnownPointTileCatalog(async () => points, fallback).tiles(13);
    const expected: Tile[] = [tileOf(137.95, 36.24, 13), tileOf(139.753, 35.694, 13)];
    expect(tiles).toEqual(expected.sort((a, b) => a.x - b.x || a.y - b.y));
  });

  it("falls back to the full list when nothing was fetched before", async () => {
    expect(await new KnownPointTileCatalog(async () => [], fallback).tiles(13)).toEqual([
      { z: 13, x: 0, y: 0 },
    ]);
  });
});
