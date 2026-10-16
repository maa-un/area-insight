// 行政区域の境界（国土数値情報 N03 の GeoJSON）を、地図の塗り分けに使える軽さに間引く。
//   node scripts/build-boundaries.mjs <行政区域.geojson> <出力.json> [許容誤差（度）]
// 画面の地図はこの出力を apps/web/src/data/boundaries.json として同梱して使う（年 1 回の更新で作り直す）。
//   node apps/batch/scripts/build-boundaries.mjs N03-20260101.geojson apps/web/src/data/boundaries.json
// 出力は市区町村（政令指定都市は行政区）ごとに 1 地物で、属性は code（5 桁）と代表点 center だけ。
//   - Douglas–Peucker 法で頂点を間引く（既定 0.002 度 ≒ 200m。全国で 3.0MB、gzip で 0.7MB。東京の区の境界まで判読できる）
//   - 間引くとほぼ面積の無くなる小さな島は落とす
//   - 座標は小数 4 桁（約 10m）に丸める
// 出典: 国土数値情報（行政区域データ）（国土交通省）をもとに合同会社Maa'un Japan 作成（CC BY 4.0）
import { createReadStream } from "node:fs";
import { writeFile } from "node:fs/promises";
import { createInterface } from "node:readline";

const [input, output, toleranceArg] = process.argv.slice(2);
if (!input || !output) {
  console.error(
    "usage: node scripts/build-boundaries.mjs <boundaries.geojson> <out.geojson> [tolerance]",
  );
  process.exit(1);
}
const TOLERANCE = Number(toleranceArg ?? 0.002);
const MIN_AREA = TOLERANCE * TOLERANCE * 4; // これより小さい輪は描いても見えない

const round = (value) => Math.round(value * 1e4) / 1e4;

// 点 p から線分 ab までの距離の 2 乗（緯度経度をそのまま平面として扱う。間引きには十分）
function segmentDistance2([px, py], [ax, ay], [bx, by]) {
  const dx = bx - ax;
  const dy = by - ay;
  const len2 = dx * dx + dy * dy;
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len2));
  const x = ax + t * dx - px;
  const y = ay + t * dy - py;
  return x * x + y * y;
}

// Douglas–Peucker 法。再帰だと深くなりすぎるため、スタックで書く。
function simplify(points) {
  if (points.length <= 4) return points;
  const keep = new Uint8Array(points.length);
  keep[0] = 1;
  keep[points.length - 1] = 1;
  const stack = [[0, points.length - 1]];
  const tolerance2 = TOLERANCE * TOLERANCE;
  while (stack.length > 0) {
    const [start, end] = stack.pop();
    let farthest = -1;
    let max = tolerance2;
    for (let i = start + 1; i < end; i++) {
      const d = segmentDistance2(points[i], points[start], points[end]);
      if (d > max) {
        max = d;
        farthest = i;
      }
    }
    if (farthest !== -1) {
      keep[farthest] = 1;
      stack.push([start, farthest], [farthest, end]);
    }
  }
  return points.filter((_, i) => keep[i]);
}

function area([...ring]) {
  let sum = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    sum += (ring[j][0] - ring[i][0]) * (ring[j][1] + ring[i][1]);
  }
  return Math.abs(sum / 2);
}

function simplifyRing(ring) {
  const simplified = simplify(ring).map(([lon, lat]) => [round(lon), round(lat)]);
  // 丸めで重なった連続する点を除く
  const deduped = simplified.filter(
    (p, i) => i === 0 || p[0] !== simplified[i - 1][0] || p[1] !== simplified[i - 1][1],
  );
  if (deduped.length < 4 || area(deduped) < MIN_AREA) return null;
  return deduped;
}

function polygonsOf(geometry) {
  if (!geometry) return [];
  return geometry.type === "Polygon" ? [geometry.coordinates] : geometry.coordinates;
}

// code -> 多角形の一覧（外周と穴）と、代表点を出すための最大の外周
const byCode = new Map();
for await (const line of createInterface({ input: createReadStream(input), crlfDelay: Infinity })) {
  const text = line.trim().replace(/,$/, "");
  if (!text.startsWith('{ "type": "Feature"') && !text.startsWith('{"type":"Feature"')) continue;
  const feature = JSON.parse(text);
  const code = feature.properties.N03_007;
  if (!code) continue; // 所属未定地など
  const entry = byCode.get(code) ?? { polygons: [], largest: null, largestArea: 0 };
  for (const polygon of polygonsOf(feature.geometry)) {
    const outer = simplifyRing(polygon[0]);
    if (!outer) continue;
    const holes = polygon.slice(1).map(simplifyRing).filter(Boolean);
    entry.polygons.push([outer, ...holes]);
    const a = area(outer);
    if (a > entry.largestArea) {
      entry.largestArea = a;
      entry.largest = outer;
    }
  }
  byCode.set(code, entry);
}

// 代表点は最大の外周の重心（細長い市町村では外にはみ出すことがあるが、色分けの位置としては十分）
function centroid(ring) {
  let [x, y, a] = [0, 0, 0];
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const f = ring[j][0] * ring[i][1] - ring[i][0] * ring[j][1];
    x += (ring[j][0] + ring[i][0]) * f;
    y += (ring[j][1] + ring[i][1]) * f;
    a += f;
  }
  return a === 0 ? ring[0] : [round(x / (3 * a)), round(y / (3 * a))];
}

const features = [];
for (const [code, entry] of [...byCode].sort(([a], [b]) => a.localeCompare(b))) {
  if (entry.polygons.length === 0) continue;
  features.push({
    type: "Feature",
    properties: { code, center: centroid(entry.largest) },
    geometry: { type: "MultiPolygon", coordinates: entry.polygons },
  });
}
const json = JSON.stringify({ type: "FeatureCollection", features });
await writeFile(output, json);
const vertices = features.reduce((sum, f) => sum + f.geometry.coordinates.flat(2).length, 0);
console.log(
  `areas: ${features.length}, vertices: ${vertices}, size: ${(json.length / 1e6).toFixed(1)}MB`,
);
