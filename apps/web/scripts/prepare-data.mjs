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
  "data_sources",
  "area_metrics",
  "area_details",
  "district_land_prices",
  "land_price_points",
  "station_metrics",
  "station_land_prices",
  "condo_transactions",
];
// 後から加えたテーブル。版の古い集計ジョブの書き出しには無いため、無くてもビルドを止めない（そのページは空になる）。
const OPTIONAL_TABLES = ["condo_transactions"];
// 版の古い集計ジョブの書き出しに無い出典の行。無ければ「時点不明」として補う（画面の検証がすべてのキーを求めるため）。
const DEFAULT_SOURCES = {
  condoTrade: { source: "XPT001", period: null, asOf: null },
};

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

// 政令指定都市の区は区名だけで届く（例: 神奈川県の「緑区」は横浜市と相模原市にある）ため、市名を前に付けて
// 「横浜市緑区」にする。区は、同じ都道府県で区のコードより小さい最大の「市」（コードの 3 桁目が 1）に属する。
// 東京 23 区は属する市が無いのでそのまま。
export function fullNames(rows) {
  const cities = rows.filter((r) => r.code[2] === "1" && r.name.endsWith("市"));
  return new Map(
    rows.map((r) => {
      if (r.code[2] !== "1" || !r.name.endsWith("区")) return [r.code, r.name];
      const city = cities
        .filter((c) => c.prefecture_code === r.prefecture_code && c.code < r.code)
        .sort((a, b) => (a.code < b.code ? 1 : -1))[0];
      return [r.code, city ? `${city.name}${r.name}` : r.name];
    }),
  );
}

// 指標ごとの出典と時点（data_sources の行）を、packages/shared の DataSources の形にする。
export function sourcesOf(rows) {
  return Object.fromEntries([
    ...Object.entries(DEFAULT_SOURCES),
    ...latestRows(rows).map((row) => [
      row.metric,
      {
        source: row.source,
        period:
          row.period_from && row.period_to ? { from: row.period_from, to: row.period_to } : null,
        asOf: row.as_of ?? null,
      },
    ]),
  ]);
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

// 駅ごとの土地の坪単価の目安。市区町村ページでは、その市区町村の土地が取引された駅だけを出す。
export function stationLandPricesOf(rows) {
  return latestRows(rows)
    .filter((row) => row.station_name)
    .map((row) => ({
      stationName: row.station_name,
      lineNames: row.line_names ?? [],
      coordinates: [Number(row.longitude), Number(row.latitude)],
      cityCodes: row.city_codes ?? [],
      count: num(row.count),
      low: num(row.low),
      median: num(row.median),
      high: num(row.high),
      periodFrom: row.period_from,
      periodTo: row.period_to,
      adjustedTo: row.adjusted_to ?? null,
      officialByStationDistance: (row.official_by_station_distance ?? []).map((b) => ({
        band: b.band,
        price: num(b.price),
        count: num(b.count),
      })),
    }))
    .sort((a, b) => b.count - a.count);
}

// マンションの成約事例を、都道府県コード → CondoFile（packages/shared）にまとめる。
// 同じ位置（最寄り駅の点）の取引を 1 つの駅にまとめ、取引は駅の添字を持つ配列にする（新しい順）。
// 駅の市区町村名は、その駅を最寄りとする取引の多い市区町村にする。
export function condosByPrefecture(rows) {
  const byPrefecture = new Map();
  for (const row of latestRows(rows)) {
    const file = byPrefecture.get(row.prefecture_code) ?? {
      prefectureCode: row.prefecture_code,
      stations: [],
      trades: [],
      index: new Map(),
    };
    byPrefecture.set(row.prefecture_code, file);
    const key = `${row.longitude},${row.latitude}`;
    let station = file.index.get(key);
    if (station === undefined) {
      station = file.stations.length;
      file.index.set(key, station);
      file.stations.push({
        name: row.station_name ?? null,
        lines: row.line_names ?? [],
        cities: new Map(),
        coordinates: [Number(row.longitude), Number(row.latitude)],
      });
    }
    const cities = file.stations[station].cities;
    if (row.city_name) cities.set(row.city_name, (cities.get(row.city_name) ?? 0) + 1);
    file.trades.push([
      station,
      row.period,
      Number(row.price),
      Number(row.area),
      row.floor_plan ?? "",
      num(row.building_year),
      row.kind === "contract" ? 1 : 0,
      row.renovated === true ? 1 : row.renovated === false ? 0 : null,
      row.district ?? "",
      row.structure ?? "",
      row.remarks ?? "",
    ]);
  }
  for (const file of byPrefecture.values()) {
    delete file.index;
    file.stations = file.stations.map(({ cities, ...station }) => ({
      ...station,
      cityName: [...cities].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null,
    }));
    // 新しい順。同じ時期は価格の高い順
    file.trades.sort((a, b) => (a[1] === b[1] ? b[2] - a[2] : a[1] < b[1] ? 1 : -1));
  }
  return byPrefecture;
}

// 地価の種類。API の priceClassification（0: 地価公示、1: 都道府県地価調査）。
const LAND_PRICE_KINDS = { 0: "official", 1: "prefecture" };

const NO_LAND_PRICES = { periodFrom: null, periodTo: null, total: null, districts: [] };

// 住宅地の地価（市区町村の中央値と、駅からの距離別）。地点が無ければ null と空の配列。
export function officialLandPricesOf(row) {
  const residential = row.official_land_price ?? null;
  return {
    residential:
      residential === null || residential.price === null || residential.price === undefined
        ? null
        : { price: num(residential.price), count: num(residential.count) },
    byStationDistance: (row.land_prices_by_station_distance ?? []).map((b) => ({
      band: b.band,
      price: num(b.price),
      count: num(b.count),
    })),
  };
}

export function convert(
  {
    data_sources,
    area_metrics,
    area_details,
    district_land_prices = [],
    land_price_points,
    station_metrics,
    station_land_prices = [],
    condo_transactions = [],
  },
  centers = new Map(),
) {
  const metrics = latestRows(area_metrics);
  const names = fullNames(metrics);
  const landPrices = landPricesByCode(district_land_prices);
  const stationLandPrices = stationLandPricesOf(station_land_prices);
  // 集計を動かした日 = 書き出しの印（実行時刻）の日付
  const updatedAt = (metrics[0]?.export_id ?? "").slice(0, 10);
  return {
    metrics: {
      updatedAt,
      sources: sourcesOf(data_sources),
      sample: false,
      areas: metrics.map((row) => ({
        code: row.code,
        prefectureCode: row.prefecture_code,
        name: names.get(row.code),
        tradePrice: num(row.trade_price),
        tradeCount: num(row.trade_count) ?? 0,
        vacancyRate: num(row.vacancy_rate),
        population: num(row.population),
        populationChangeRate: num(row.population_change_rate),
        projectedPopulation2050: num(row.projected_population_2050),
        projectedChangeRate: num(row.projected_change_rate),
        grossYield: num(row.gross_yield),
        monthlyRent: num(row.monthly_rent),
        rentPerSqm: num(row.rent_per_sqm),
        landUnitPrice: num(row.land_unit_price),
        landTradeCount: num(row.land_trade_count) ?? 0,
        landPriceChangeRate: num(row.land_price_change_rate),
        officialLandPrice: num(row.official_land_price),
        officialLandPriceChangeRate: num(row.official_land_price_change_rate),
        landToOfficialRatio: num(row.land_to_official_ratio),
        rentGap: num(row.rent_gap),
        landGap: num(row.land_gap),
        momentumGap: num(row.momentum_gap),
        weakDemand: row.weak_demand === true,
        center: centers.get(row.code) ?? lngLat(row.center_lng ?? null, row.center_lat ?? null),
      })),
    },
    details: latestRows(area_details).map((row) => ({
      code: row.code,
      landPrices: landPrices.get(row.code) ?? NO_LAND_PRICES,
      officialLandPrices: officialLandPricesOf(row),
      stationLandPrices: stationLandPrices.filter((s) => s.cityCodes.includes(row.code)),
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
      populationProjection: (row.population_projection ?? []).map((p) => ({
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
      kind: LAND_PRICE_KINDS[row.classification] ?? "official",
      asOf: row.as_of,
      coordinates: [Number(row.longitude), Number(row.latitude)],
      price: num(row.price),
      changeRate: num(row.change_rate),
      use: row.use ?? "",
      location: row.location ?? "",
      stationName: row.station_name ?? null,
      stationDistance: num(row.station_distance_m),
    })),
    condos: [...condosByPrefecture(condo_transactions).values()],
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

// テーブルの書き出し（NDJSON）を読む。
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
  const files = Object.fromEntries(
    await Promise.all(
      TABLES.map(async (name) => [
        name,
        (await readdir(join(dir, "exports", name)).catch(() => [])).some((f) =>
          f.endsWith(".json"),
        ),
      ]),
    ),
  );
  if (tables.area_metrics.length === 0) {
    console.log("no exports found; building with sample data");
    return;
  }
  // 書き出しの途中（EXPORT DATA が古いファイルを消してから書く間）に取ると、一部のテーブルのファイルが無くなる。
  // そのまま作ると画面から項目が消えるため、ビルドを失敗させる。行が 0 のファイルは正常（例: 地価の取り込み前）。
  const missing = TABLES.filter((name) => !files[name] && !OPTIONAL_TABLES.includes(name));
  if (missing.length > 0) {
    throw new Error(
      `exports are incomplete (no files): ${missing.join(", ")}; retry after the aggregate job finishes`,
    );
  }
  const boundaries = JSON.parse(
    await readFile(new URL("../src/data/boundaries.json", import.meta.url), "utf8"),
  );
  const data = convert(tables, centersOf(boundaries));
  const out = fileURLToPath(new URL("../src/data/generated/", import.meta.url));
  await rm(out, { recursive: true, force: true });
  await mkdir(join(out, "details"), { recursive: true });
  await mkdir(join(out, "condos"), { recursive: true });
  await writeFile(join(out, "metrics.json"), JSON.stringify(data.metrics));
  await writeFile(join(out, "land-prices.json"), JSON.stringify(data.landPrices));
  await writeFile(join(out, "stations.json"), JSON.stringify(data.stations));
  for (const detail of data.details) {
    await writeFile(join(out, "details", `${detail.code}.json`), JSON.stringify(detail));
  }
  for (const condo of data.condos) {
    await writeFile(join(out, "condos", `${condo.prefectureCode}.json`), JSON.stringify(condo));
  }
  const condoTrades = data.condos.reduce((sum, file) => sum + file.trades.length, 0);
  console.log(
    `prepared ${data.metrics.areas.length} areas, ${data.landPrices.length} land prices, ${data.stations.length} stations, ${condoTrades} condo trades`,
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
