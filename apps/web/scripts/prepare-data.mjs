// 集計ジョブの書き出し（BigQuery の EXPORT DATA、NDJSON）を、画面が読む形に直して src/data/generated/ に置く。
//   node scripts/prepare-data.mjs <書き出しを置いたディレクトリ>
// ディレクトリには exports/<テーブル名>/*.json の形で置く（gcloud storage cp -r で取ったまま）。
// 書き出しが無ければ何もしない。そのとき画面はサンプルデータでビルドされる。
// 形の検証は画面のビルド時に zod で行う（src/data/index.ts）。
// 市区町村の代表点は、同梱した境界（src/data/boundaries.json）の center で置き換える。
// 境界に無い市区町村だけ、集計ジョブの代表点（地価の地点などの平均位置）を残す。
import { mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const TABLES = [
  "area_metrics",
  "area_details",
  "district_land_prices",
  "land_price_points",
  "station_metrics",
];

// BigQuery の JSON 書き出しは INT64 を文字列にするため、数値に戻す。
const num = (value) => (value === null || value === undefined ? null : Number(value));
const lngLat = (lng, lat) => (lng === null || lat === null ? null : [Number(lng), Number(lat)]);

// 同じ場所に前回の分割ファイルが残ることがあるため、最新の export_id の行だけを使う。
export function latestRows(rows) {
  const latest = rows.reduce((max, row) => (row.export_id > max ? row.export_id : max), "");
  return rows.filter((row) => row.export_id === latest);
}

// 境界の GeoJSON から、市区町村コード → 代表点 [経度, 緯度]
export function centersOf(boundaries) {
  return new Map(boundaries.features.map((f) => [f.properties.code, f.properties.center]));
}

// 土地の取引単価の分布を、市区町村コード → { periodFrom, periodTo, total, districts } にまとめる。
// district が null の行は市区町村全体。
export function landPricesByCode(rows) {
  const byCode = new Map();
  for (const row of latestRows(rows)) {
    const entry = byCode.get(row.code) ?? {
      periodFrom: row.period_from ?? null,
      periodTo: row.period_to ?? null,
      total: null,
      districts: [],
    };
    const stats = {
      count: num(row.count),
      quantiles: (row.quantiles ?? []).map(Number),
      medianArea: num(row.median_area),
    };
    if (row.district === null || row.district === undefined) entry.total = stats;
    else entry.districts.push({ district: row.district, ...stats });
    byCode.set(row.code, entry);
  }
  for (const entry of byCode.values()) entry.districts.sort((a, b) => b.count - a.count);
  return byCode;
}

const NO_LAND_PRICES = { periodFrom: null, periodTo: null, total: null, districts: [] };

export function convert(
  { area_metrics, area_details, district_land_prices = [], land_price_points, station_metrics },
  centers = new Map(),
) {
  const metrics = latestRows(area_metrics);
  const landPrices = landPricesByCode(district_land_prices);
  const asOf = metrics.map((row) => row.as_of).find(Boolean);
  return {
    metrics: {
      asOf,
      sample: false,
      areas: metrics.map((row) => ({
        code: row.code,
        prefectureCode: row.prefecture_code,
        name: row.name,
        tradePrice: num(row.trade_price),
        tradeCount: num(row.trade_count) ?? 0,
        vacancyRate: num(row.vacancy_rate),
        population: num(row.population),
        populationChangeRate: num(row.population_change_rate),
        grossYield: num(row.gross_yield),
        monthlyRent: num(row.monthly_rent),
        center: centers.get(row.code) ?? lngLat(row.center_lng ?? null, row.center_lat ?? null),
      })),
    },
    details: latestRows(area_details).map((row) => ({
      code: row.code,
      landPrices: landPrices.get(row.code) ?? NO_LAND_PRICES,
      quarters: (row.quarters ?? []).map((q) => ({
        period: q.period,
        price: num(q.price),
        count: num(q.count),
      })),
      years: (row.years ?? []).map((y) => ({
        year: num(y.year),
        price: num(y.price),
        count: num(y.count),
      })),
      populationHistory: (row.population_history ?? []).map((p) => ({
        year: num(p.year),
        population: num(p.population),
      })),
      recentTransactions: (row.recent_transactions ?? []).map((t) => ({
        period: t.period,
        district: t.district ?? "",
        price: num(t.price),
        landArea: num(t.land_area),
        floorArea: num(t.floor_area),
        buildingYear: num(t.building_year),
      })),
    })),
    landPrices: latestRows(land_price_points).map((row) => ({
      pointId: String(row.point_id),
      coordinates: [Number(row.longitude), Number(row.latitude)],
      price: num(row.price),
      changeRate: num(row.change_rate),
      use: row.use ?? "",
      location: row.location ?? "",
    })),
    stations: latestRows(station_metrics).map((row) => ({
      stationName: row.station_name ?? null,
      lineNames: row.line_names ?? [],
      cityName: row.city_name ?? null,
      coordinates: [Number(row.longitude), Number(row.latitude)],
      medianPrice: num(row.median_price),
      count: num(row.count),
    })),
  };
}

async function readTable(dir, name) {
  const folder = join(dir, "exports", name);
  const files = (await readdir(folder).catch(() => [])).filter((file) => file.endsWith(".json"));
  const rows = [];
  for (const file of files) {
    for (const line of (await readFile(join(folder, file), "utf8")).split("\n")) {
      if (line.trim()) rows.push(JSON.parse(line));
    }
  }
  return rows;
}

async function main(dir) {
  const tables = Object.fromEntries(
    await Promise.all(TABLES.map(async (name) => [name, await readTable(dir, name)])),
  );
  if (tables.area_metrics.length === 0) {
    console.log("no exports found; building with sample data");
    return;
  }
  const boundaries = JSON.parse(
    await readFile(new URL("../src/data/boundaries.json", import.meta.url), "utf8"),
  );
  const data = convert(tables, centersOf(boundaries));
  const out = fileURLToPath(new URL("../src/data/generated/", import.meta.url));
  await rm(out, { recursive: true, force: true });
  await mkdir(join(out, "details"), { recursive: true });
  await writeFile(join(out, "metrics.json"), JSON.stringify(data.metrics));
  await writeFile(join(out, "land-prices.json"), JSON.stringify(data.landPrices));
  await writeFile(join(out, "stations.json"), JSON.stringify(data.stations));
  for (const detail of data.details) {
    await writeFile(join(out, "details", `${detail.code}.json`), JSON.stringify(detail));
  }
  console.log(
    `prepared ${data.metrics.areas.length} areas, ${data.landPrices.length} land prices, ${data.stations.length} stations`,
  );
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const dir = process.argv[2];
  if (!dir) {
    console.error("usage: node scripts/prepare-data.mjs <export-dir>");
    process.exit(1);
  }
  await main(dir);
}
