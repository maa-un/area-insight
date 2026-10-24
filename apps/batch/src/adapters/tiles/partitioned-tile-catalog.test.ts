import { describe, expect, it } from "vitest";
import type { Tile } from "../../ports.js";
import { PartitionedTileCatalog } from "./partitioned-tile-catalog.js";

const tiles: Tile[] = Array.from({ length: 103 }, (_, x) => ({ z: 13, x, y: 0 }));
const source = { tiles: async () => tiles };

describe("PartitionedTileCatalog", () => {
  it("covers every tile exactly once across all partitions", async () => {
    const parts = await Promise.all(
      Array.from({ length: 8 }, (_, part) => new PartitionedTileCatalog(source, part, 8).tiles(13)),
    );
    const combined = parts.flat();
    expect(combined).toHaveLength(tiles.length);
    expect(new Set(combined.map((tile) => tile.x)).size).toBe(tiles.length);
    expect(combined.toSorted((a, b) => a.x - b.x)).toEqual(tiles);
    expect(Math.max(...parts.map((part) => part.length))).toBe(13);
  });

  it.each([
    [-1, 8],
    [8, 8],
    [0, 0],
    [0, 65],
    [0.5, 8],
    [0, Number.NaN],
  ])("rejects invalid partition %s/%s", (part, parts) => {
    expect(() => new PartitionedTileCatalog(source, part, parts)).toThrow("invalid tile partition");
  });
});
