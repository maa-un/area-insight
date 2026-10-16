import type { Tile } from "../../ports.js";

// 経度・緯度を含む地図タイル（XYZ 方式、Web メルカトル）。scripts/build-tiles.mjs と同じ式。
export function tileOf(longitude: number, latitude: number, z: number): Tile {
  const n = 2 ** z;
  const rad = (latitude * Math.PI) / 180;
  return {
    z,
    x: Math.floor(((longitude + 180) / 360) * n),
    y: Math.floor(((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * n),
  };
}

// 重複を除き、x・y の順に並べる。
export function uniqueTiles(tiles: Iterable<Tile>): Tile[] {
  const byKey = new Map<string, Tile>();
  for (const tile of tiles) byKey.set(`${tile.z}/${tile.x}/${tile.y}`, tile);
  return [...byKey.values()].sort((a, b) => a.x - b.x || a.y - b.y);
}
