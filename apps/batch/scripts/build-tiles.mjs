// 行政区域の境界（GeoJSON）から、陸地を含む地図タイルの一覧を作る。
//   node scripts/build-tiles.mjs <行政区域.geojson>
// 出力: tiles/z11.json（駅ごとの取引）、tiles/z13.json（地価）。中身は [[x, y], ...]。
//
// 境界データは国土数値情報「行政区域」（N03）を想定している。タイルは次のどちらかを満たせば採用する。
//   - 境界の頂点がタイルの中にある
//   - タイルの中心か四隅のどれかが境界の内側にある
// 細い岬や小島の一部を取りこぼすことはあるが、地価の地点や駅はほぼ内陸にあるため実用上問題ない。
import { createReadStream } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { createInterface } from "node:readline";

const ZOOMS = [11, 13];

const input = process.argv[2];
if (!input) {
  console.error("usage: node scripts/build-tiles.mjs <boundaries.geojson>");
  process.exit(1);
}

const lon2x = (lon, z) => Math.floor(((lon + 180) / 360) * 2 ** z);
const lat2y = (lat, z) => {
  const rad = (lat * Math.PI) / 180;
  return Math.floor(((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * 2 ** z);
};
const x2lon = (x, z) => (x / 2 ** z) * 360 - 180;
const y2lat = (y, z) => {
  const n = Math.PI - (2 * Math.PI * y) / 2 ** z;
  return (180 / Math.PI) * Math.atan(Math.sinh(n));
};

// 外周（穴は無視する）の内側にあるか。レイキャスティング法。
function inside([lon, lat], ring) {
  let hit = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > lat !== yj > lat && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) hit = !hit;
  }
  return hit;
}

function outerRings(geometry) {
  if (!geometry) return [];
  if (geometry.type === "Polygon") return [geometry.coordinates[0]];
  if (geometry.type === "MultiPolygon") return geometry.coordinates.map((polygon) => polygon[0]);
  return [];
}

// 全国の境界は 500MB を超え、1 つの文字列として読めない。N03 の GeoJSON は 1 行に 1 地物なので、行ごとに読む。
const rings = [];
for await (const line of createInterface({ input: createReadStream(input), crlfDelay: Infinity })) {
  const text = line.trim().replace(/,$/, "");
  if (!text.startsWith('{ "type": "Feature"') && !text.startsWith('{"type":"Feature"')) continue;
  rings.push(...outerRings(JSON.parse(text).geometry));
}
console.log(`rings: ${rings.length}`);

await mkdir(new URL("../tiles/", import.meta.url), { recursive: true });

for (const z of ZOOMS) {
  const tiles = new Set();
  for (const ring of rings) {
    // 頂点を含むタイル
    for (const [lon, lat] of ring) tiles.add(`${lon2x(lon, z)},${lat2y(lat, z)}`);
    // 外接矩形の中で、中心か四隅が内側にあるタイル
    // 頂点が数十万ある境界もあるため、スプレッド構文（Math.min(...)）を使わずに外接矩形を求める
    let [west, east, south, north] = [180, -180, 90, -90];
    for (const [lon, lat] of ring) {
      if (lon < west) west = lon;
      if (lon > east) east = lon;
      if (lat < south) south = lat;
      if (lat > north) north = lat;
    }
    const [x0, x1] = [lon2x(west, z), lon2x(east, z)];
    const [y0, y1] = [lat2y(north, z), lat2y(south, z)];
    for (let x = x0; x <= x1; x++) {
      for (let y = y0; y <= y1; y++) {
        const key = `${x},${y}`;
        if (tiles.has(key)) continue;
        const [w, e, n, s] = [x2lon(x, z), x2lon(x + 1, z), y2lat(y, z), y2lat(y + 1, z)];
        const probes = [
          [(w + e) / 2, (n + s) / 2],
          [w, n],
          [e, n],
          [w, s],
          [e, s],
        ];
        if (probes.some((point) => inside(point, ring))) tiles.add(key);
      }
    }
  }
  const list = [...tiles]
    .map((key) => key.split(",").map(Number))
    .sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  await writeFile(new URL(`../tiles/z${z}.json`, import.meta.url), `${JSON.stringify(list)}\n`);
  console.log(`z${z}: ${list.length} tiles`);
}
