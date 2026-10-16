import type { AreaMetrics } from "@area-insight/shared";
import { dataset } from "@/data";

// PropFolio（収支計算）へエリアの相場を渡すリンク。仕様書「PropFolio との相乗効果」。
// 渡し方（パラメータ名と単位）は PropFolio 側と要調整（仕様書の未決事項）。決まるまでは仮の名前で渡す。
// 値は元データの時点と一緒に渡し、PropFolio 側で古いデータを使っていると分かるようにする。
const PROPFOLIO_URL = "https://propfolio.maa-un.com/";

export function propfolioUrl(area: AreaMetrics): string {
  const url = new URL(PROPFOLIO_URL);
  url.searchParams.set("utm_source", "area-insight");
  url.searchParams.set("area", area.code);
  if (area.tradePrice !== null) url.searchParams.set("price", String(area.tradePrice * 10000));
  if (area.monthlyRent !== null) url.searchParams.set("rent", String(area.monthlyRent));
  // 土地の取引単価の中央値（円/㎡）と空き家率（%）・人口の 5 年増減率（%）。空室率・家賃下落率の目安に使う
  if (area.landUnitPrice !== null)
    url.searchParams.set("land_unit_price", String(area.landUnitPrice));
  if (area.vacancyRate !== null) url.searchParams.set("vacancy_rate", String(area.vacancyRate));
  if (area.populationChangeRate !== null)
    url.searchParams.set("population_change_rate", String(area.populationChangeRate));
  // 元データの時点（YYYY-MM-DD）。取引は期間の終わり、家賃は調査の時点
  const { tradePrice, monthlyRent } = dataset.sources;
  const tradeAsOf = tradePrice.period?.to ?? tradePrice.asOf;
  if (tradeAsOf) url.searchParams.set("price_as_of", tradeAsOf);
  if (monthlyRent.asOf) url.searchParams.set("rent_as_of", monthlyRent.asOf);
  return url.toString();
}
