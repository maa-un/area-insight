import type {
  AreaDetail,
  AreaMetrics,
  AreaMetricsFile,
  LandPricePoint,
  LngLat,
  StationMetrics,
} from "@area-insight/shared";

// API キー（不動産情報ライブラリ）とアプリケーション ID（e-Stat）が届くまで画面を作り込むための
// サンプルデータ。市区町村コード・名称・位置は実在のものだが、指標の値はすべて作り物。
// 画面には sample = true を見てサンプルである旨を必ず表示する。

type Seed = {
  code: string;
  name: string;
  center: LngLat;
  price: number; // 取引価格の中央値の目安（万円）
  vacancy: number; // 空き家率の目安（%）
  population: number;
  trend: number; // 5 年の人口増減率の目安（%）
};

const SEEDS: Seed[] = [
  {
    code: "01101",
    name: "札幌市中央区",
    center: [141.35, 43.055],
    price: 3200,
    vacancy: 11.8,
    population: 250000,
    trend: 4.1,
  },
  {
    code: "01202",
    name: "函館市",
    center: [140.729, 41.769],
    price: 950,
    vacancy: 16.2,
    population: 240000,
    trend: -7.5,
  },
  {
    code: "01203",
    name: "小樽市",
    center: [140.995, 43.19],
    price: 720,
    vacancy: 18.9,
    population: 107000,
    trend: -9.8,
  },
  {
    code: "01204",
    name: "旭川市",
    center: [142.365, 43.771],
    price: 1080,
    vacancy: 15.1,
    population: 320000,
    trend: -5.2,
  },
  {
    code: "01205",
    name: "室蘭市",
    center: [140.973, 42.315],
    price: 620,
    vacancy: 19.6,
    population: 76000,
    trend: -9.1,
  },
  {
    code: "01206",
    name: "釧路市",
    center: [144.382, 42.985],
    price: 680,
    vacancy: 17.4,
    population: 158000,
    trend: -8.3,
  },
  {
    code: "01207",
    name: "帯広市",
    center: [143.196, 42.924],
    price: 1350,
    vacancy: 13.2,
    population: 162000,
    trend: -3.4,
  },
  {
    code: "01213",
    name: "苫小牧市",
    center: [141.605, 42.634],
    price: 1020,
    vacancy: 14.7,
    population: 168000,
    trend: -3.9,
  },
  {
    code: "03201",
    name: "盛岡市",
    center: [141.153, 39.702],
    price: 1650,
    vacancy: 13.9,
    population: 280000,
    trend: -4.6,
  },
  {
    code: "04202",
    name: "石巻市",
    center: [141.303, 38.434],
    price: 980,
    vacancy: 15.3,
    population: 136000,
    trend: -7.2,
  },
  {
    code: "05201",
    name: "秋田市",
    center: [140.102, 39.72],
    price: 1280,
    vacancy: 14.4,
    population: 297000,
    trend: -5.8,
  },
  {
    code: "07203",
    name: "郡山市",
    center: [140.383, 37.4],
    price: 1480,
    vacancy: 13.6,
    population: 316000,
    trend: -4.4,
  },
  {
    code: "09201",
    name: "宇都宮市",
    center: [139.884, 36.555],
    price: 1980,
    vacancy: 14.8,
    population: 514000,
    trend: -1.2,
  },
  {
    code: "10202",
    name: "高崎市",
    center: [139.003, 36.322],
    price: 1720,
    vacancy: 15.6,
    population: 368000,
    trend: -2.3,
  },
  {
    code: "11203",
    name: "川口市",
    center: [139.724, 35.808],
    price: 3650,
    vacancy: 9.8,
    population: 600000,
    trend: 1.6,
  },
  {
    code: "12203",
    name: "市川市",
    center: [139.931, 35.722],
    price: 3900,
    vacancy: 10.4,
    population: 490000,
    trend: 0.9,
  },
  {
    code: "13101",
    name: "千代田区",
    center: [139.753, 35.694],
    price: 12800,
    vacancy: 13.1,
    population: 68000,
    trend: 6.8,
  },
  {
    code: "13104",
    name: "新宿区",
    center: [139.704, 35.694],
    price: 9200,
    vacancy: 12.6,
    population: 349000,
    trend: 2.4,
  },
  {
    code: "13112",
    name: "世田谷区",
    center: [139.653, 35.646],
    price: 7600,
    vacancy: 10.2,
    population: 917000,
    trend: 0.8,
  },
  {
    code: "13201",
    name: "八王子市",
    center: [139.316, 35.666],
    price: 2850,
    vacancy: 11.9,
    population: 560000,
    trend: -1.8,
  },
  {
    code: "14201",
    name: "横須賀市",
    center: [139.672, 35.281],
    price: 2350,
    vacancy: 13.4,
    population: 384000,
    trend: -4.9,
  },
  {
    code: "14204",
    name: "鎌倉市",
    center: [139.547, 35.319],
    price: 5300,
    vacancy: 11.0,
    population: 176000,
    trend: -0.6,
  },
  {
    code: "15202",
    name: "長岡市",
    center: [138.851, 37.446],
    price: 1350,
    vacancy: 14.1,
    population: 260000,
    trend: -5.6,
  },
  {
    code: "17201",
    name: "金沢市",
    center: [136.626, 36.561],
    price: 2250,
    vacancy: 13.7,
    population: 446000,
    trend: -1.9,
  },
  {
    code: "20201",
    name: "長野市",
    center: [138.181, 36.648],
    price: 1700,
    vacancy: 15.3,
    population: 368000,
    trend: -3.6,
  },
  {
    code: "20202",
    name: "松本市",
    center: [137.972, 36.238],
    price: 1880,
    vacancy: 14.6,
    population: 236000,
    trend: -2.4,
  },
  {
    code: "20203",
    name: "上田市",
    center: [138.249, 36.402],
    price: 1420,
    vacancy: 16.4,
    population: 152000,
    trend: -4.1,
  },
  {
    code: "20205",
    name: "飯田市",
    center: [137.822, 35.515],
    price: 1180,
    vacancy: 17.2,
    population: 96000,
    trend: -6.3,
  },
  {
    code: "22205",
    name: "熱海市",
    center: [139.072, 35.096],
    price: 1550,
    vacancy: 50.4,
    population: 34000,
    trend: -6.9,
  },
  {
    code: "26201",
    name: "福知山市",
    center: [135.126, 35.297],
    price: 1050,
    vacancy: 15.8,
    population: 76000,
    trend: -4.8,
  },
  {
    code: "27203",
    name: "豊中市",
    center: [135.469, 34.781],
    price: 4150,
    vacancy: 11.5,
    population: 400000,
    trend: -0.4,
  },
  {
    code: "28201",
    name: "姫路市",
    center: [134.686, 34.815],
    price: 1950,
    vacancy: 14.0,
    population: 526000,
    trend: -2.6,
  },
  {
    code: "30201",
    name: "和歌山市",
    center: [135.171, 34.226],
    price: 1250,
    vacancy: 18.2,
    population: 356000,
    trend: -4.7,
  },
  {
    code: "32201",
    name: "松江市",
    center: [133.049, 35.468],
    price: 1300,
    vacancy: 15.9,
    population: 198000,
    trend: -3.8,
  },
  {
    code: "33202",
    name: "倉敷市",
    center: [133.772, 34.585],
    price: 1850,
    vacancy: 13.8,
    population: 474000,
    trend: -1.7,
  },
  {
    code: "34202",
    name: "呉市",
    center: [132.566, 34.249],
    price: 980,
    vacancy: 19.8,
    population: 207000,
    trend: -8.6,
  },
  {
    code: "34204",
    name: "三原市",
    center: [133.079, 34.398],
    price: 1020,
    vacancy: 17.6,
    population: 89000,
    trend: -6.4,
  },
  {
    code: "34205",
    name: "尾道市",
    center: [133.205, 34.409],
    price: 1100,
    vacancy: 18.4,
    population: 128000,
    trend: -6.1,
  },
  {
    code: "34207",
    name: "福山市",
    center: [133.362, 34.486],
    price: 1650,
    vacancy: 15.2,
    population: 460000,
    trend: -2.8,
  },
  {
    code: "38201",
    name: "松山市",
    center: [132.766, 33.839],
    price: 1700,
    vacancy: 15.4,
    population: 505000,
    trend: -2.5,
  },
  {
    code: "39201",
    name: "高知市",
    center: [133.531, 33.559],
    price: 1380,
    vacancy: 16.7,
    population: 320000,
    trend: -4.3,
  },
  {
    code: "40202",
    name: "大牟田市",
    center: [130.446, 33.03],
    price: 880,
    vacancy: 18.1,
    population: 108000,
    trend: -7.4,
  },
  {
    code: "40203",
    name: "久留米市",
    center: [130.508, 33.319],
    price: 1750,
    vacancy: 13.5,
    population: 302000,
    trend: -1.5,
  },
  {
    code: "42201",
    name: "長崎市",
    center: [129.874, 32.75],
    price: 1450,
    vacancy: 17.9,
    population: 400000,
    trend: -7.9,
  },
  {
    code: "46201",
    name: "鹿児島市",
    center: [130.557, 31.597],
    price: 1850,
    vacancy: 15.6,
    population: 590000,
    trend: -2.9,
  },
  {
    code: "47201",
    name: "那覇市",
    center: [127.681, 26.212],
    price: 3800,
    vacancy: 9.4,
    population: 316000,
    trend: -0.7,
  },
];

export const SAMPLE_AS_OF = "2026-09-30";

// level を中心に ±spread の幅で広がる 21 個の分位（0%〜100%、5% 刻み）。100 円単位に丸める。
function quantilesAround(level: number, spread: number): number[] {
  return Array.from({ length: 21 }, (_, i) =>
    Math.max(0, Math.round((level * (1 - spread + (i / 20) * 2 * spread)) / 100) * 100),
  );
}

// コードから決まる疑似乱数。ビルドのたびに同じ値になる。
function random(seed: string): () => number {
  let state = [...seed].reduce((acc, ch) => (acc * 31 + ch.charCodeAt(0)) >>> 0, 2166136261);
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const round = (value: number, digits = 0) => {
  const base = 10 ** digits;
  return Math.round(value * base) / base;
};

function metricsFor(seed: Seed): AreaMetrics {
  const rand = random(seed.code);
  // 人口の少ない町ほど取引が少ない。閾値未満（参考値）の例も混ぜる。
  const tradeCount = Math.max(3, Math.round((seed.population / 2500) * (0.6 + rand() * 0.8)));
  const monthlyRent = Math.round((45000 + seed.price * 9 + rand() * 15000) / 1000) * 1000;
  return {
    code: seed.code,
    prefectureCode: seed.code.slice(0, 2),
    name: seed.name,
    tradePrice: seed.price,
    tradeCount,
    vacancyRate: seed.vacancy,
    population: seed.population,
    populationChangeRate: seed.trend,
    grossYield: round(((monthlyRent * 12) / (seed.price * 10000)) * 100, 1),
    monthlyRent,
    center: seed.center,
  };
}

export const sampleMetrics: AreaMetricsFile = {
  asOf: SAMPLE_AS_OF,
  sample: true,
  areas: SEEDS.map(metricsFor),
};

const QUARTERS = Array.from({ length: 20 }, (_, i) => {
  const index = 2021 * 4 + 3 + i; // 2021Q4 から 20 四半期（2026Q3 まで）
  return `${Math.floor(index / 4)}Q${(index % 4) + 1}`;
});

export function sampleDetail(code: string): AreaDetail | undefined {
  const seed = SEEDS.find((s) => s.code === code);
  if (!seed) return undefined;
  const rand = random(`${code}:detail`);
  const growth = seed.trend / 100 / 4 + 0.002; // 人口が増える所ほど価格も上がる作り
  const metrics = metricsFor(seed);
  const perQuarter = Math.max(1, Math.round(metrics.tradeCount / 4));

  const quarters = QUARTERS.map((period, i) => {
    const count = Math.max(0, Math.round(perQuarter * (0.5 + rand())));
    const level = seed.price * (1 + growth) ** (i - QUARTERS.length + 1);
    return {
      period,
      price: count === 0 ? null : round(level * (0.9 + rand() * 0.2)),
      count,
    };
  });

  // 年の値は、その年の四半期の値を件数で重み付けした平均で代用する（実データでは年の中央値）。
  const years = [...new Set(quarters.map((q) => Number(q.period.slice(0, 4))))].map((year) => {
    const inYear = quarters.filter((q) => q.period.startsWith(String(year)) && q.price !== null);
    const count = inYear.reduce((sum, q) => sum + q.count, 0);
    const total = inYear.reduce((sum, q) => sum + (q.price ?? 0) * q.count, 0);
    return { year, price: count === 0 ? null : round(total / count), count };
  });

  const populationHistory = Array.from({ length: 6 }, (_, i) => ({
    year: 2021 + i,
    population: Math.round(seed.population / (1 + (seed.trend / 100) * ((5 - i) / 5))),
  }));

  const recentTransactions = Array.from({ length: 8 }, (_, i) => {
    const landArea = round(90 + rand() * 180);
    return {
      period: QUARTERS[QUARTERS.length - 1 - Math.floor(i / 2)] ?? QUARTERS[0] ?? "2026Q3",
      district: `サンプル地区 ${i + 1}`,
      price: round(seed.price * (0.5 + rand()), -1),
      landArea,
      floorArea: round(landArea * (0.5 + rand() * 0.4)),
      buildingYear: 1975 + Math.floor(rand() * 45),
    };
  });

  // 土地（宅地(土地)）の取引単価（円/㎡）。戸建の相場から土地分をおおまかに置き、地区ごとに差を付ける。
  const baseUnit = ((seed.price * 10000) / 180) * 0.6;
  const districts = Array.from({ length: 5 }, (_, i) => {
    const level = baseUnit * (0.5 + rand() * 1.2);
    return {
      district: `サンプル地区 ${i + 1}`,
      count: 5 + Math.floor(rand() * 40),
      quantiles: quantilesAround(level, 0.35 + rand() * 0.3),
      medianArea: round(150 + rand() * 150),
    };
  });
  const landPrices = {
    periodFrom: QUARTERS[QUARTERS.length - 8] ?? null,
    periodTo: QUARTERS[QUARTERS.length - 1] ?? null,
    total: {
      count: districts.reduce((sum, d) => sum + d.count, 0),
      quantiles: quantilesAround(baseUnit, 0.7),
      medianArea: round(200 + rand() * 60),
    },
    districts,
  };

  return { code, quarters, years, populationHistory, landPrices, recentTransactions };
}

// 地図の地価ポイントと駅ごとの取引相場。市区町村の代表点のまわりに置く。
export const sampleLandPrices: LandPricePoint[] = SEEDS.flatMap((seed) => {
  const rand = random(`${seed.code}:land`);
  return Array.from({ length: 4 }, (_, i) => {
    const commercial = i === 0;
    const price = round((seed.price / 3000) * 90000 * (commercial ? 2.5 : 0.6 + rand()), -2);
    return {
      pointId: `${seed.code}-${i + 1}`,
      coordinates: [
        round(seed.center[0] + (rand() - 0.5) * 0.08, 5),
        round(seed.center[1] + (rand() - 0.5) * 0.06, 5),
      ] satisfies LngLat,
      price,
      changeRate: round(seed.trend / 2 + (rand() - 0.4) * 3, 1),
      use: commercial ? "商業地" : "住宅地",
      location: `${seed.name} サンプル地点 ${i + 1}`,
    };
  });
});

export const sampleStations: StationMetrics[] = SEEDS.flatMap((seed) => {
  const rand = random(`${seed.code}:station`);
  return Array.from({ length: 2 }, (_, i) => ({
    stationName: `${seed.name}サンプル${i + 1}`,
    lineNames: ["サンプル線"],
    cityName: seed.name,
    coordinates: [
      round(seed.center[0] + (rand() - 0.5) * 0.05, 5),
      round(seed.center[1] + (rand() - 0.5) * 0.04, 5),
    ] satisfies LngLat,
    medianPrice: round(seed.price * (0.7 + rand() * 0.6), -1),
    count: Math.max(2, Math.round((seed.population / 20000) * rand())),
  }));
});
