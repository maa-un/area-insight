import { type AreaMetrics, prefectureName } from "@area-insight/shared";
import {
  ArrowRight,
  ArrowUpRight,
  Columns3,
  ListOrdered,
  Map as MapIcon,
  Search,
  Sparkles,
  TrendingUp,
} from "lucide-react";
import type { ComponentType, CSSProperties } from "react";
import { Bar, CountUp } from "@/components/brand";
import { openSearch } from "@/components/search-dialog";
import { Button } from "@/components/ui/button";
import { Kbd } from "@/components/ui/kbd";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { dataset, METRICS, type MetricKey, metricPeriod, rankableAreas, sortAreas } from "@/data";
import { formatDate, formatMetric } from "@/lib/format";
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
  { key: "grossYield", order: "desc", title: "利回りが高い" },
  { key: "tradePrice", order: "asc", title: "価格が手ごろ" },
  { key: "populationChangeRate", order: "desc", title: "人口が増加" },
  { key: "rentGap", order: "desc", title: "家賃が割安" },
];

const topOf = (key: MetricKey, order: "asc" | "desc", count: number) =>
  sortAreas(rankableAreas(dataset.areas, key, false), key, order).slice(0, count);

const delay = (i: number) => ({ "--i": i }) as CSSProperties;

export function HomePage() {
  return (
    <div className="flex flex-col gap-10 lg:gap-14">
      <Hero />

      <section className="grid gap-3 sm:grid-cols-3" aria-label="探し方">
        {entries.map(({ title, body, href, icon: Icon }, i) => (
          <a
            key={title}
            href={href}
            style={delay(i + 3)}
            className="stagger group relative flex flex-col gap-3 overflow-hidden rounded-2xl border bg-card p-5 transition-all duration-300 hover:-translate-y-1 hover:border-primary/30 hover:shadow-xl hover:shadow-primary/5 focus-visible:outline-2"
          >
            <span className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary transition-all duration-300 group-hover:scale-110 group-hover:bg-primary group-hover:text-primary-foreground">
              <Icon className="size-5" aria-hidden />
            </span>
            <span className="flex items-center gap-1 font-semibold">
              {title}
              <ArrowRight className="size-4 -translate-x-1 opacity-0 transition-all duration-300 group-hover:translate-x-0 group-hover:opacity-100" />
            </span>
            <span className="text-sm text-muted-foreground">{body}</span>
          </a>
        ))}
      </section>

      <Highlights />
    </div>
  );
}

function Hero() {
  const preview = topOf("grossYield", "desc", 3);
  return (
    <section className="relative isolate overflow-hidden rounded-3xl border bg-card px-6 py-8 sm:px-10 sm:py-10">
      {/* 背景でゆっくり漂う色のにじみ */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute -top-24 -right-16 size-80 animate-float rounded-full bg-primary/25 blur-3xl" />
        <div className="absolute -bottom-32 left-1/4 size-96 animate-float rounded-full bg-amber-300/25 blur-3xl [animation-delay:-7s]" />
        <div className="absolute inset-0 bg-[linear-gradient(to_right,var(--border)_1px,transparent_1px),linear-gradient(to_bottom,var(--border)_1px,transparent_1px)] bg-[size:40px_40px] opacity-50 [mask-image:radial-gradient(ellipse_at_top_left,black_20%,transparent_70%)]" />
      </div>

      <div className="grid items-center gap-10 lg:grid-cols-[1fr_340px]">
        <div className="flex flex-col gap-6">
          <p
            className="stagger inline-flex w-fit items-center gap-2 rounded-full border bg-background/70 px-3 py-1 text-xs font-medium text-muted-foreground backdrop-blur"
            style={delay(0)}
          >
            <Sparkles className="size-3.5 text-primary" aria-hidden />
            全国 {dataset.areas.length.toLocaleString("ja-JP")} 市区町村を公的データで
          </p>
          <h1 className="sr-only">市区町村を公的データで比べる</h1>
          <p className="stagger max-w-xl text-pretty text-muted-foreground" style={delay(1)}>
            取引価格・地価・空き家率・人口の推移を、市区町村ごとに。物件を探す前の、エリア選びのための調査ツールです。
          </p>
          <div className="stagger flex flex-col gap-3 sm:flex-row" style={delay(2)}>
            <button
              type="button"
              onClick={openSearch}
              className="group flex h-14 w-full items-center gap-3 rounded-2xl border bg-background px-5 text-left text-muted-foreground shadow-sm transition-all hover:border-primary/40 hover:shadow-md hover:shadow-primary/10 sm:max-w-md"
            >
              <Search className="size-5 transition-transform group-hover:scale-110" aria-hidden />
              市区町村名で検索（例: 松本市）
              <Kbd className="ml-auto hidden sm:inline-flex">⌘K</Kbd>
            </button>
            <Button asChild size="lg" className="h-14 rounded-2xl px-6 shadow-md shadow-primary/25">
              <a href="/map/">
                <MapIcon />
                地図をひらく
              </a>
            </Button>
          </div>
        </div>

        {/* 実際の数字が動くプレビュー。アプリの画面の一部を見せる */}
        <div
          className="stagger hidden rotate-1 rounded-2xl border bg-background/80 p-5 shadow-2xl shadow-primary/10 backdrop-blur transition-transform duration-500 hover:rotate-0 lg:block"
          style={delay(4)}
        >
          <div className="mb-4 flex items-center justify-between">
            <p className="flex items-center gap-2 text-sm font-semibold">
              <TrendingUp className="size-4 text-primary" aria-hidden />
              {METRICS.grossYield.label}
            </p>
            <span className="rounded-full bg-good/10 px-2 py-0.5 text-[11px] font-medium text-good">
              TOP 3
            </span>
          </div>
          <TopList areas={preview} metric="grossYield" />
          <p className="mt-4 text-[11px] text-muted-foreground">
            データ更新 {formatDate(dataset.updatedAt)}
          </p>
        </div>
      </div>
    </section>
  );
}

function Highlights() {
  return (
    <section className="reveal flex flex-col gap-4" aria-labelledby="highlights">
      <Tabs defaultValue={highlights[0]?.key}>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 id="highlights" className="text-xl">
            主なランキング
          </h2>
          <TabsList className="h-9! w-full overflow-x-auto sm:w-auto">
            {highlights.map(({ key, title }) => (
              <TabsTrigger key={key} value={key} className="px-3">
                {title}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>
        {highlights.map(({ key, order }) => (
          <TabsContent
            key={key}
            value={key}
            className="mt-4 rounded-2xl border bg-card p-5 animate-in fade-in slide-in-from-bottom-2 duration-500 sm:p-6"
          >
            <div className="mb-5 flex flex-wrap items-end justify-between gap-2">
              <div>
                <p className="font-semibold">{METRICS[key].label}</p>
                <p className="text-xs text-muted-foreground">{metricPeriod(key)}</p>
              </div>
              <Button asChild variant="ghost" size="sm" className="text-muted-foreground">
                <a href={`/rankings/?metric=${key}&order=${order}`}>
                  すべて見る
                  <ArrowUpRight />
                </a>
              </Button>
            </div>
            <TopList areas={topOf(key, order, 8)} metric={key} columns />
          </TabsContent>
        ))}
      </Tabs>
    </section>
  );
}

// 上位を、値の大きさが分かる横棒付きで並べる。上位 3 つは差し色。
function TopList({
  areas,
  metric,
  columns = false,
}: {
  areas: AreaMetrics[];
  metric: MetricKey;
  columns?: boolean;
}) {
  const max = Math.max(...areas.map((a) => Math.abs(a[metric] ?? 0)), 0);
  return (
    <ol className={cn("grid gap-x-10 gap-y-4 text-sm", columns && "md:grid-cols-2")}>
      {areas.map((area, i) => (
        <li key={area.code} className="stagger flex flex-col gap-1.5" style={delay(i)}>
          <a href={areaPath(area.code)} className="group flex items-center gap-3">
            <span
              className={cn(
                "flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-bold tabular-nums",
                i < 3 ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
              )}
            >
              {i + 1}
            </span>
            <span className="flex-1 truncate font-medium group-hover:text-primary">
              {area.name}
              <span className="ml-1.5 text-xs font-normal text-muted-foreground">
                {prefectureName(area.prefectureCode)}
              </span>
            </span>
            <CountUp className="font-bold tabular-nums" text={formatMetric(metric, area[metric])} />
          </a>
          <Bar
            value={Math.abs(area[metric] ?? 0)}
            max={max}
            highlight={i < 3}
            className="ml-9 w-auto"
          />
        </li>
      ))}
    </ol>
  );
}
