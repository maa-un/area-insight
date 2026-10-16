import { PREFECTURE_CODES } from "@area-insight/shared";
import type { MunicipalityRecord, PublicDataSource, RawDataStore } from "../ports.js";

// 47 都道府県の市区町村一覧を取り直し、全体を置き換える。
export async function fetchMunicipalities(
  source: PublicDataSource,
  store: RawDataStore,
  now: Date,
): Promise<number> {
  const rows: { prefectureCode: string; record: MunicipalityRecord }[] = [];
  for (const prefectureCode of PREFECTURE_CODES) {
    for (const record of await source.municipalities(prefectureCode)) {
      rows.push({ prefectureCode, record });
    }
  }
  await store.replaceMunicipalities(rows, now);
  return rows.length;
}
