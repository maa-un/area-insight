import {
  type LandPricePoint,
  LandPricePoints,
  type StationMetrics,
  StationMetricsList,
} from "@area-insight/shared";
import { sampleLandPrices, sampleStations } from "./sample";

// 地価の地点と駅ごとの相場。全国分で大きい（地価だけで 10MB を超える）ため画面の JavaScript には含めず、
// ハッシュ付きのファイルとして出力して、地図のページで取りに行く。
// 集計ジョブの書き出しが無ければサンプル（src/data/sample.ts）を使う。
const urls = import.meta.glob<string>("./generated/{land-prices,stations}.json", {
  eager: true,
  query: "?url",
  import: "default",
});

async function fetchJson(url: string): Promise<unknown> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`地図のデータを取得できませんでした（HTTP ${response.status}）`);
  }
  return response.json();
}

export async function loadLandPrices(): Promise<LandPricePoint[]> {
  const url = urls["./generated/land-prices.json"];
  // 外から来るデータとして検証する
  return LandPricePoints.parse(url ? await fetchJson(url) : sampleLandPrices);
}

export async function loadStations(): Promise<StationMetrics[]> {
  const url = urls["./generated/stations.json"];
  return StationMetricsList.parse(url ? await fetchJson(url) : sampleStations);
}
