import { type AreaMetrics, prefectureName } from "@area-insight/shared";
import { ChevronRight, Columns3, ListOrdered, Map as MapIcon, Search } from "lucide-react";
import { type ComponentType, useId, useState } from "react";
import { Bar, Eyebrow } from "@/components/brand";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { dataset, METRICS, type MetricKey, metricPeriod, rankableAreas, sortAreas } from "@/data";
import { formatMetric } from "@/lib/format";
import { cn } from "@/lib/utils";
import { areaPath } from "@/routes";

const entries: {
  title: string;
  body: string;
  href: string;
  icon: ComponentType<{ className?: string }>;
}[] = [
  {
    title: "地図で探す",
    body: "地価や駅ごとの相場を、周辺の市区町村と見比べる",
    href: "/map/",
    icon: MapIcon,
  },
  {
    title: "ランキングで探す",
    body: "取引価格や空き家率で絞り込み、条件に合う市区町村を並べる",
    href: "/rankings/",
    icon: ListOrdered,
  },
  {
    title: "比較する",
    body: "気になる市区町村を 3 つまで横に並べて比べる",
    href: "/compare/",
    icon: Columns3,
  },
];

const highlights: { key: MetricKey; order: "asc" | "desc"; title: string }[] = [
  { key: "grossYield", order: "desc", title: "想定利回りが高い" },
  { key: "tradePrice", order: "asc", title: "取引価格が手ごろ" },
  { key: "populationChangeRate", order: "desc", title: "人口が増えている" },
];

export function HomePage() {
  return (
    <div className="flex flex-col gap-14">
      <section className="flex flex-col gap-6 py-2 sm:py-6">
        <Eyebrow>
          全国 {dataset.areas.length.toLocaleString("ja-JP")} 市区町村を公的データで
        </Eyebrow>
        <h1 className="max-w-3xl text-4xl font-extrabold tracking-tight text-balance sm:text-5xl">
          その土地、<span className="text-terracotta">高い</span>のか
          <span className="text-terracotta">安い</span>のか。
        </h1>
        <p className="max-w-2xl text-pretty text-lg text-muted-foreground">
          取引価格・地価・空き家率・人口の推移を、市区町村ごとに。物件を探す前の、エリア選びのための調査ツールです。
        </p>
        <AreaSearch />
      </section>

      <section className="grid gap-4 sm:grid-cols-3" aria-label="探し方">
        {entries.map(({ title, body, href, icon: Icon }) => (
          <a key={title} href={href} className="group rounded-xl focus-visible:outline-2">
            <Card className="h-full transition-colors group-hover:bg-muted/40">
              <CardHeader>
                <span className="inline-flex size-10 items-center justify-center rounded-full bg-terracotta/10 text-terracotta">
                  <Icon className="size-5" aria-hidden />
                </span>
                <CardTitle className="mt-2 flex items-center gap-1">
                  {title}
                  <ChevronRight className="size-4 transition-transform group-hover:translate-x-0.5" />
                </CardTitle>
                <CardDescription>{body}</CardDescription>
              </CardHeader>
            </Card>
          </a>
        ))}
      </section>

      <section className="flex flex-col gap-4" aria-labelledby="highlights">
        <div className="flex items-baseline justify-between">
          <h2 id="highlights" className="text-xl font-semibold tracking-tight">
            主なランキング
          </h2>
          <a href="/rankings/" className="text-sm text-muted-foreground hover:text-foreground">
            すべて見る
          </a>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {highlights.map(({ key, order, title }) => (
            <Card key={key}>
              <CardHeader>
                <CardTitle className="text-base">{title}</CardTitle>
                <CardDescription>
                  {METRICS[key].label}・{metricPeriod(key)}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <TopList
                  areas={sortAreas(rankableAreas(dataset.areas, key, false), key, order).slice(
                    0,
                    5,
                  )}
                  metric={key}
                />
                <a
                  href={`/rankings/?metric=${key}&order=${order}`}
                  className="mt-4 inline-block text-xs text-muted-foreground hover:text-foreground"
                >
                  続きを見る
                </a>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>
    </div>
  );
}

// 市区町村名で探す。全件をブラウザに持っているので、入力のたびに絞り込む。
function AreaSearch() {
  const [query, setQuery] = useState("");
  const listId = useId();
  const q = query.trim();
  const matches = q
    ? dataset.areas
        .filter((a) => `${prefectureName(a.prefectureCode)}${a.name}`.includes(q))
        .slice(0, 8)
    : [];

  return (
    <div className="relative w-full max-w-md text-left">
      <Search
        className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
        aria-hidden
      />
      <Input
        className="h-12 bg-card pl-10 text-base"
        placeholder="市区町村名で検索（例: 松本市）"
        aria-label="市区町村名で検索"
        aria-controls={listId}
        aria-expanded={matches.length > 0}
        role="combobox"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        onKeyDown={(event) => {
          const first = matches[0];
          if (event.key === "Enter" && first) window.location.href = areaPath(first.code);
        }}
      />
      {q && (
        <ul
          id={listId}
          className="absolute inset-x-0 top-full z-10 mt-1 overflow-hidden rounded-lg border bg-popover text-sm shadow-md"
        >
          {matches.length === 0 ? (
            <li className="px-3 py-2 text-muted-foreground">見つかりませんでした</li>
          ) : (
            matches.map((area) => (
              <li key={area.code}>
                <a
                  href={areaPath(area.code)}
                  className="flex justify-between px-3 py-2 hover:bg-muted"
                >
                  {area.name}
                  <span className="text-muted-foreground">
                    {prefectureName(area.prefectureCode)}
                  </span>
                </a>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}

// 上位 5 つを、値の大きさが分かる横棒付きで並べる。1 位だけテラコッタ。
function TopList({ areas, metric }: { areas: AreaMetrics[]; metric: MetricKey }) {
  const max = Math.max(...areas.map((a) => Math.abs(a[metric] ?? 0)), 0);
  return (
    <ol className="flex flex-col gap-3 text-sm">
      {areas.map((area, i) => (
        <li key={area.code} className="flex flex-col gap-1">
          <div className="flex items-center gap-3">
            <span
              className={cn(
                "w-5 text-xs font-bold tabular-nums",
                i === 0 ? "text-terracotta" : "text-muted-foreground",
              )}
            >
              {i + 1}
            </span>
            <a href={areaPath(area.code)} className="flex-1 truncate font-medium hover:underline">
              {area.name}
              <span className="ml-1 text-xs font-normal text-muted-foreground">
                {prefectureName(area.prefectureCode)}
              </span>
            </a>
            <span className="font-bold tabular-nums">{formatMetric(metric, area[metric])}</span>
          </div>
          <Bar
            value={Math.abs(area[metric] ?? 0)}
            max={max}
            highlight={i === 0}
            className="ml-8 w-auto"
          />
        </li>
      ))}
    </ol>
  );
}
