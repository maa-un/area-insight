import { type AreaDetail, prefectureName, RELIABLE_TRADE_COUNT } from "@area-insight/shared";
import { ArrowUpRight, Building2, ChevronRight, Map as MapIcon, MapPin } from "lucide-react";
import type { CSSProperties } from "react";
import { AreaActions } from "@/components/area-actions";
import { Chip, CountUp, PositionBar } from "@/components/brand";
import { LandPriceSection } from "@/components/land-prices";
import { MarketDistortionSection } from "@/components/market-distortion";
import { StationLandPriceSection } from "@/components/station-land-prices";
import { TrendChart, yearName } from "@/components/trend-chart";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { VacancySection } from "@/components/vacancy";
import {
  dataset,
  findArea,
  METRICS,
  type MetricKey,
  metricPeriod,
  nearbyAreas,
  prefectureRank,
  yieldPeriodNote,
} from "@/data";
import { condoPrefectures } from "@/data/condos";
import {
  formatCount,
  formatManYen,
  formatMetric,
  formatPercent,
  formatQuarter,
  NO_DATA,
} from "@/lib/format";
import { formatDataPeriod } from "@/lib/period";
import { propfolioUrl } from "@/lib/propfolio";
import { areaVerdict } from "@/lib/verdict";
import { areaPath } from "@/routes";

// 各指標の説明と時点。時点はすべての数字のそばに出す（仕様書「時点の表示ルール」）。
const SUMMARY: { key: MetricKey; note: string }[] = [
  { key: "tradePrice", note: "宅地（土地と建物）の取引価格の中央値" },
  { key: "grossYield", note: "家賃相場 × 12 ÷ 取引価格。エリアの目安" },
  { key: "vacancyRate", note: "空き家数 ÷ 住宅総数" },
  { key: "populationChangeRate", note: "過去 5 年の増減" },
];

export function AreaPage({ detail }: { detail: AreaDetail }) {
  const area = findArea(detail.code);
  if (!area) return null;
  const prefecture = prefectureName(area.prefectureCode);
  const reference = area.tradeCount < RELIABLE_TRADE_COUNT;
  const verdict = areaVerdict(area, prefecture, prefectureRank(area, "tradePrice"));

  return (
    <article className="flex flex-col gap-8">
      <nav
        aria-label="パンくず"
        className="flex items-center gap-1 text-xs text-muted-foreground animate-rise"
      >
        <a href="/" className="transition-colors hover:text-foreground">
          トップ
        </a>
        <ChevronRight className="size-3.5" aria-hidden />
        <a
          href={`/rankings/?pref=${area.prefectureCode}`}
          className="transition-colors hover:text-foreground"
        >
          {prefecture}
        </a>
        <ChevronRight className="size-3.5" aria-hidden />
        <span className="text-foreground">{area.name}</span>
      </nav>

      <header className="relative isolate flex flex-col gap-6 overflow-hidden rounded-3xl border bg-card p-6 animate-rise sm:p-8">
        <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
          <div className="absolute -top-20 -right-10 size-72 animate-float rounded-full bg-primary/20 blur-3xl" />
          <div className="absolute -bottom-24 left-1/3 size-72 animate-float rounded-full bg-amber-300/20 blur-3xl [animation-delay:-6s]" />
        </div>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex flex-col gap-2">
            <p className="inline-flex w-fit items-center gap-1.5 rounded-full border bg-background/70 px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
              <MapPin className="size-3 text-primary" aria-hidden />
              {prefecture}
            </p>
            <h1 className="text-4xl font-extrabold sm:text-5xl">{area.name}</h1>
            <p className="text-muted-foreground">中古戸建・空き家の相場と、土地の高い・安い</p>
          </div>
          <AreaActions code={area.code} />
        </div>
        {verdict && (
          <div className="flex flex-col gap-3 rounded-2xl border border-primary/25 bg-background/70 p-5 backdrop-blur">
            <p className="text-lg font-bold leading-snug sm:text-xl">{verdict.sentence}</p>
            <div className="flex flex-wrap gap-2">
              {verdict.tags.map((tag) => (
                <Chip key={tag.label} tone={tag.tone}>
                  {tag.label}
                </Chip>
              ))}
            </div>
          </div>
        )}
      </header>

      <section aria-label="主な指標" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {SUMMARY.map(({ key, note }, i) => {
          const rank = prefectureRank(area, key);
          return (
            <Card
              key={key}
              className="stagger gap-2 py-4 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-primary/5"
              style={{ "--i": i + 1 } as CSSProperties}
            >
              <CardHeader className="px-4">
                <CardDescription>{METRICS[key].label}</CardDescription>
                <CardTitle className="flex items-center gap-2 text-3xl font-bold tracking-tight tabular-nums">
                  <CountUp text={formatMetric(key, area[key])} />
                  {key === "tradePrice" && reference && area.tradePrice !== null && (
                    <Badge variant="outline">参考値</Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-1 px-4 text-xs text-muted-foreground">
                <p>{note}</p>
                <p>{metricPeriod(key)}</p>
                {key === "grossYield" && yieldPeriodNote() && (
                  <p className="text-bad">{yieldPeriodNote()}</p>
                )}
                {key === "tradePrice" && <p>取引件数 {formatCount(area.tradeCount, "件")}</p>}
                {rank && (
                  <div className="flex flex-col gap-1.5">
                    <p>
                      {prefecture}内 {rank.total} 市区町村中 {rank.rank} 位
                    </p>
                    <PositionBar
                      percent={rank.total > 1 ? ((rank.rank - 1) / (rank.total - 1)) * 100 : 50}
                    />
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </section>

      <div className="reveal">
        <LandPriceSection
          areaName={area.name}
          landPrices={detail.landPrices}
          official={detail.officialLandPrices}
        />
      </div>

      <div className="reveal">
        <StationLandPriceSection areaName={area.name} stations={detail.stationLandPrices} />
      </div>

      <div className="reveal">
        <VacancySection area={area} prefecture={prefecture} breakdown={detail.vacancyBreakdown} />
      </div>

      <div className="reveal">
        <MarketDistortionSection area={area} prefecture={prefecture} />
      </div>

      <div className="reveal grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>取引価格の推移</CardTitle>
            <CardDescription>宅地（土地と建物）の取引価格の中央値（過去 5 年）</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-6">
            <TrendChart quarters={detail.quarters} years={detail.years} />
            <YearTable years={detail.years} latestQuarter={detail.quarters.at(-1)?.period} />
          </CardContent>
        </Card>

        <div className="flex flex-col gap-6">
          <Card className="relative overflow-hidden border-0 bg-gradient-to-br from-primary to-[oklch(0.5_0.15_32)] text-primary-foreground shadow-lg shadow-primary/20 ring-0 [&_[data-slot=card-description]]:text-primary-foreground/80">
            <CardHeader>
              <CardTitle>この相場で収支を計算する</CardTitle>
              <CardDescription>
                取引価格 {formatManYen(area.tradePrice)}（
                {formatDataPeriod(dataset.sources.tradePrice)}
                ）・家賃相場{" "}
                {area.monthlyRent === null
                  ? NO_DATA
                  : `${area.monthlyRent.toLocaleString("ja-JP")}円/月`}
                （{formatDataPeriod(dataset.sources.monthlyRent)}）を入れた状態で PropFolio
                を開きます。
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                asChild
                variant="secondary"
                className="group/cta h-10 w-full bg-white text-primary hover:bg-white/90"
              >
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
              <p className="text-xs text-muted-foreground">{metricPeriod("population")}</p>
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
              {detail.populationProjection.length > 0 && (
                <PopulationProjection
                  rows={detail.populationProjection}
                  changeRate={area.projectedChangeRate}
                />
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>近くの市区町村</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <ul className="flex flex-col gap-0.5 text-sm">
                {nearbyAreas(area).map((other) => (
                  <li key={other.code}>
                    <a
                      href={areaPath(other.code)}
                      className="-mx-2 flex justify-between gap-2 rounded-lg px-2 py-1.5 transition-colors hover:bg-accent hover:text-accent-foreground"
                    >
                      <span className="truncate font-medium">{other.name}</span>
                      <span className="tabular-nums text-muted-foreground">
                        {formatManYen(other.tradePrice)}
                      </span>
                    </a>
                  </li>
                ))}
              </ul>
              <Button asChild variant="outline" size="sm">
                <a href={`/map/?area=${area.code}`}>
                  <MapIcon />
                  地図で周辺と見比べる
                </a>
              </Button>
              {condoPrefectures.includes(area.prefectureCode) && (
                <Button asChild variant="outline" size="sm">
                  <a href={`/condos/?pref=${area.prefectureCode}`}>
                    <Building2 />
                    {prefecture}のマンション成約事例
                  </a>
                </Button>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <Card className="reveal">
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

// 将来推計人口（社人研）。2020 年は国勢調査の実績、以降は 5 年ごとの推計。2050 年の増減率を見出しに出す。
function PopulationProjection({
  rows,
  changeRate,
}: {
  rows: AreaDetail["populationProjection"];
  changeRate: number | null;
}) {
  return (
    <div className="mt-4 flex flex-col gap-2 border-t pt-3">
      <p className="text-sm">
        将来推計 2050年 {formatCount(rows.at(-1)?.population ?? null, "人")}（2020年比{" "}
        {formatPercent(changeRate, { signed: true })}）
      </p>
      <p className="text-xs text-muted-foreground">{metricPeriod("projectedChangeRate")}</p>
      <table className="w-full text-xs text-muted-foreground">
        <tbody>
          {rows.map((row) => (
            <tr key={row.year} className="border-b border-dashed last:border-0">
              <th scope="row" className="py-1 text-left font-normal">
                {row.year}年{row.year === 2020 ? "（実績）" : "（推計）"}
              </th>
              <td className="py-1 text-right tabular-nums">
                {row.population.toLocaleString("ja-JP")}人
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function YearTable({
  years,
  latestQuarter,
}: {
  years: AreaDetail["years"];
  latestQuarter: string | undefined;
}) {
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
              <td className="py-2">{yearName(row.year, latestQuarter)}</td>
              <td className="py-2 text-right">{formatManYen(row.price)}</td>
              <td
                className={
                  row.change === null
                    ? "py-2 text-right text-muted-foreground"
                    : row.change >= 0
                      ? "py-2 text-right text-good"
                      : "py-2 text-right text-bad"
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
