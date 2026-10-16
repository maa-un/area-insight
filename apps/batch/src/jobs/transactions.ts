import { PREFECTURE_CODES } from "@area-insight/shared";
import type { PublicDataSource, RawDataStore, TransactionRecord } from "../ports.js";
import { formatQuarter, type Quarter } from "../quarters.js";

// 四半期ごとに 47 都道府県を取り直し、その四半期を丸ごと置き換える。
export async function fetchTransactions(
  source: PublicDataSource,
  store: RawDataStore,
  quarters: readonly Quarter[],
  now: Date,
): Promise<Map<string, number>> {
  const counts = new Map<string, number>();
  for (const quarter of quarters) {
    const rows: { prefectureCode: string; record: TransactionRecord }[] = [];
    for (const prefectureCode of PREFECTURE_CODES) {
      for (const record of await source.transactions(prefectureCode, quarter)) {
        rows.push({ prefectureCode, record });
      }
    }
    await store.replaceTransactions(quarter, rows, now);
    counts.set(formatQuarter(quarter), rows.length);
  }
  return counts;
}
