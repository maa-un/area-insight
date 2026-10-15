import { PREFECTURE_CODES } from "@area-insight/shared";
import type { BigQueryWriter, TableSpec } from "../bigquery.js";
import type { ReinfolibClient } from "../reinfolib.js";

export const RAW_MUNICIPALITIES: TableSpec = {
  name: "raw_municipalities",
  schema: [
    { name: "code", type: "STRING", mode: "REQUIRED" },
    { name: "prefecture_code", type: "STRING", mode: "REQUIRED" },
    { name: "name", type: "STRING", mode: "REQUIRED" },
    { name: "fetched_at", type: "TIMESTAMP", mode: "REQUIRED" },
  ],
};

// 47 都道府県の市区町村一覧を取り直し、テーブル全体を置き換える。
export async function fetchMunicipalities(
  client: ReinfolibClient,
  writer: BigQueryWriter,
  now: Date,
): Promise<number> {
  const rows: Record<string, unknown>[] = [];
  for (const prefectureCode of PREFECTURE_CODES) {
    for (const municipality of await client.municipalities(prefectureCode)) {
      rows.push({
        code: municipality.id,
        prefecture_code: prefectureCode,
        name: municipality.name,
        fetched_at: now.toISOString(),
      });
    }
  }
  await writer.replace(RAW_MUNICIPALITIES, rows);
  return rows.length;
}
