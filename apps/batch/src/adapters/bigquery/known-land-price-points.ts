import { BigQuery } from "@google-cloud/bigquery";
import type { KnownPoints } from "../tiles/known-point-tile-catalog.js";
import { RAW_LAND_PRICES } from "./raw-rows.js";

// これまでに取得した地価の地点の位置（全年）。テーブルがまだ無ければ空。
// 同じ地点は毎年同じ位置で返るため、重複を除いて数万件に収まる。
export function knownLandPricePoints(projectId: string, datasetId: string): KnownPoints {
  const client = new BigQuery({ projectId });
  return async () => {
    const [exists] = await client.dataset(datasetId).table(RAW_LAND_PRICES.name).exists();
    if (!exists) return [];
    const [rows] = await client.query({
      query: `
        SELECT DISTINCT ROUND(longitude, 5) AS longitude, ROUND(latitude, 5) AS latitude
        FROM \`${projectId}.${datasetId}.${RAW_LAND_PRICES.name}\``,
    });
    return (rows as { longitude: number; latitude: number }[]).map(
      (row) => [row.longitude, row.latitude] as const,
    );
  };
}
