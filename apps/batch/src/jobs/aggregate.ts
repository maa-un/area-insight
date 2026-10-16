import type { MetricsWarehouse } from "../ports.js";

// 取得ジョブの後に動かす。指標を作り直してから、画面向けのファイルを書き出す。
export async function aggregate(warehouse: MetricsWarehouse, now: Date): Promise<string> {
  await warehouse.rebuildMetrics();
  // 書き出しの印は実行時刻。同じ場所に前回の分割ファイルが残っても、印で見分けられる。
  const exportId = now.toISOString();
  await warehouse.exportForWeb(exportId);
  return exportId;
}
