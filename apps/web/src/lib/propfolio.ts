import type { AreaMetrics } from "@area-insight/shared";

// PropFolio（収支計算）へエリアの相場を渡すリンク。
// 渡し方（パラメータ名と単位）は PropFolio 側と要調整（仕様書の未決事項）。決まるまでは仮の名前で渡す。
const PROPFOLIO_URL = "https://propfolio.maa-un.com/";

export function propfolioUrl(area: AreaMetrics): string {
  const url = new URL(PROPFOLIO_URL);
  url.searchParams.set("utm_source", "area-insight");
  url.searchParams.set("area", area.code);
  if (area.tradePrice !== null) url.searchParams.set("price", String(area.tradePrice * 10000));
  if (area.monthlyRent !== null) url.searchParams.set("rent", String(area.monthlyRent));
  return url.toString();
}
