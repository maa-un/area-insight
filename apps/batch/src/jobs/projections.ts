import { PREFECTURE_CODES } from "@area-insight/shared";
import type { ProjectionRecord, ProjectionSource, RawDataStore } from "../ports.js";

// 将来推計人口（社人研）を 47 都道府県分まとめて取り直し、全体を置き換える。推計は約 5 年ごと。
export async function fetchProjections(
  source: ProjectionSource,
  store: RawDataStore,
  now: Date,
): Promise<number> {
  const rows: ProjectionRecord[] = [];
  for (const prefectureCode of PREFECTURE_CODES) {
    rows.push(...(await source.projections(prefectureCode)));
  }
  await store.replaceProjections(rows, now);
  return rows.length;
}
