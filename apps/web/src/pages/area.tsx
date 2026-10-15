import { type AreaDetail, prefectureName, RELIABLE_TRADE_COUNT } from "@area-insight/shared";
import { ArrowUpRight, ChevronRight, Map as MapIcon } from "lucide-react";
import { AreaActions } from "@/components/area-actions";
import { TrendChart } from "@/components/trend-chart";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { findArea, METRICS, type MetricKey, nearbyAreas, prefectureRank } from "@/data";
import {
  formatCount,
  formatManYen,
  formatMetric,
  formatPercent,
  formatQuarter,
  NO_DATA,
} from "@/lib/format";
import { propfolioUrl } from "@/lib/propfolio";
import { areaPath } from "@/routes";

const SUMMARY: { key: MetricKey; note: string }[] = [
  { key: "tradePrice", note: "直近 4 四半期の宅地（土地と建物）の取引" },
  { key: "grossYield", note: "家賃相場 × 12 ÷ 取引価格。エリアの目安" },
  { key: "vacancyRate", note: "空き家数 ÷ 住宅総数" },
  { key: "populationChangeRate", note: "過去 5 年の増減" },
];

export function AreaPage({ detail }: { detail: AreaDetail }) {
  const area = findArea(detail.code);
  if (!area) return null;
  const prefecture = prefectureName(area.prefectureCode);
  const reference = area.tradeCount < RELIABLE_TRADE_COUNT;

  return (
    <article className="flex flex-col gap-8">
      <nav aria-label="パンくず" className="flex items-center gap-1 text-sm text-muted-foreground">
        <a href="/" className="hover:text-foreground">
          トップ
        </a>
        <ChevronRight className="size-3.5" aria-hidden />
        <a href={`/rankings/?pref=${area.prefectureCode}`} className="hover:text-foreground">
          {prefecture}
        </a>
        <ChevronRight className="size-3.5" aria-hidden />
        <span className="text-foreground">{area.name}</span>
      </nav>

      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-col gap-1">
          <p className="text-sm text-muted-foreground">{prefecture}</p>
          <h1 className="text-3xl font-bold tracking-tight">{area.name}の中古戸建・空き家の相場</h1>
        </div>
        <AreaActions code={area.code} />
      </header>

      <section aria-label="主な指標" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {SUMMARY.map(({ key, note }) => {
          const rank = prefectureRank(area, key);
          return (
            <Card key={key} className="gap-2 py-4">
              <CardHeader className="px-4">
                <CardDescription>{METRICS[key].label}</CardDescription>
                <CardTitle className="flex items-center gap-2 text-2xl tabular-nums">
                  {formatMetric(key, area[key])}
                  {key === "tradePrice" && reference && area.tradePrice !== null && (
                    <Badge variant="outline">参考値</Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-1 px-4 text-xs text-muted-foreground">
                <p>{note}</p>
                {key === "tradePrice" && <p>取引件数 {formatCount(area.tradeCount, "件")}</p>}
                {rank && (
                  <p>
                    {prefecture}内 {rank.total} 市区町村中 {rank.rank} 位
                  </p>
                )}
              </CardContent>
            </Card>
          );
        })}
      </section>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>取引価格の推移</CardTitle>
            <CardDescription>四半期ごとの中央値（過去 5 年）</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-6">
            <TrendChart quarters={detail.quarters} />
            <YearTable years={detail.years} />
          </CardContent>
        </Card>

        <div className="flex flex-col gap-6">
          <Card className="border-primary/20 bg-primary/[0.03]">
            <CardHeader>
              <CardTitle>この相場で収支を計算する</CardTitle>
              <CardDescription>
                取引価格 {formatManYen(area.tradePrice)}・家賃相場{" "}
                {area.monthlyRent === null
                  ? NO_DATA
                  : `${area.monthlyRent.toLocaleString("ja-JP")}円/月`}{" "}
                を入れた状態で PropFolio を開きます。
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild className="w-full">
                <a href={propfolioUrl(area)} target="_blank" rel="noopener">
                  PropFolio で計算する
                  <ArrowUpRight />
                </a>
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>人口</CardTitle>
              <CardDescription>
                {formatCount(area.population, "人")}（5 年で{" "}
                {formatPercent(area.populationChangeRate, { signed: true })}）
              </CardDescription>
            </CardHeader>
            <CardContent>
              <table className="w-full text-sm">
                <tbody>
                  {detail.populationHistory.map((row) => (
                    <tr key={row.year} className="border-b last:border-0">
                      <th
                        scope="row"
                        className="py-1.5 text-left font-normal text-muted-foreground"
                      >
                        {row.year}年
                      </th>
                      <td className="py-1.5 text-right tabular-nums">
                        {row.population.toLocaleString("ja-JP")}人
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>近くの市区町村</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <ul className="flex flex-col gap-2 text-sm">
                {nearbyAreas(area).map((other) => (
                  <li key={other.code} className="flex justify-between gap-2">
                    <a href={areaPath(other.code)} className="truncate hover:underline">
                      {other.name}
                    </a>
                    <span className="tabular-nums text-muted-foreground">
                      {formatManYen(other.tradePrice)}
                    </span>
                  </li>
                ))}
              </ul>
              <Button asChild variant="outline" size="sm">
                <a href={`/map/?area=${area.code}`}>
                  <MapIcon />
                  地図で周辺と見比べる
                </a>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>直近の取引</CardTitle>
          <CardDescription>
            宅地（土地と建物）の取引の例。地区名までで、物件は特定できません。
          </CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-sm">
            <thead className="text-left text-muted-foreground">
              <tr className="border-b">
                <th className="py-2 font-medium">取引時期</th>
                <th className="py-2 font-medium">地区</th>
                <th className="py-2 text-right font-medium">取引価格</th>
                <th className="py-2 text-right font-medium">土地</th>
                <th className="py-2 text-right font-medium">延床</th>
                <th className="py-2 text-right font-medium">建築年</th>
              </tr>
            </thead>
            <tbody className="tabular-nums">
              {detail.recentTransactions.map((t) => (
                <tr key={`${t.period}-${t.district}-${t.price}`} className="border-b last:border-0">
                  <td className="py-2">{formatQuarter(t.period)}</td>
                  <td className="py-2">{t.district}</td>
                  <td className="py-2 text-right">{formatManYen(t.price)}</td>
                  <td className="py-2 text-right">
                    {t.landArea === null ? "—" : `${t.landArea}㎡`}
                  </td>
                  <td className="py-2 text-right">
                    {t.floorArea === null ? "—" : `${t.floorArea}㎡`}
                  </td>
                  <td className="py-2 text-right">
                    {t.buildingYear === null ? "—" : `${t.buildingYear}年`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </article>
  );
}

function YearTable({ years }: { years: AreaDetail["years"] }) {
  return (
    <table className="w-full text-sm">
      <thead className="text-left text-muted-foreground">
        <tr className="border-b">
          <th className="py-2 font-medium">年</th>
          <th className="py-2 text-right font-medium">中央値</th>
          <th className="py-2 text-right font-medium">前年比</th>
          <th className="py-2 text-right font-medium">件数</th>
        </tr>
      </thead>
      <tbody className="tabular-nums">
        {years
          .map((row, i) => {
            const prev = years[i - 1]?.price;
            const change =
              row.price !== null && prev != null && prev > 0
                ? ((row.price - prev) / prev) * 100
                : null;
            return { ...row, change };
          })
          .reverse()
          .map((row) => (
            <tr key={row.year} className="border-b last:border-0">
              <td className="py-2">{row.year}年</td>
              <td className="py-2 text-right">{formatManYen(row.price)}</td>
              <td
                className={
                  row.change === null
                    ? "py-2 text-right text-muted-foreground"
                    : row.change >= 0
                      ? "py-2 text-right text-emerald-700"
                      : "py-2 text-right text-rose-700"
                }
              >
                {row.change === null ? "—" : formatPercent(row.change, { signed: true })}
              </td>
              <td className="py-2 text-right">
                {row.count}件
                {row.count < RELIABLE_TRADE_COUNT && (
                  <span className="ml-1 text-xs">（参考値）</span>
                )}
              </td>
            </tr>
          ))}
      </tbody>
    </table>
  );
}
