import type { AreaDetail, AreaMetrics } from "@area-insight/shared";
import { Chip } from "@/components/brand";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { METRICS, type MetricKey, metricPeriod, prefectureRank } from "@/data";
import { formatCount, formatMetric, formatPercent } from "@/lib/format";

// 空き家の内訳と、前回の調査（5 年前）からの増減（住宅・土地統計調査）。
// 「賃貸・売却用及び二次的住宅を除く空き家」は、市場に出ていない空き家（いわゆる放置空き家）として示す。

type Breakdown = NonNullable<AreaDetail["vacancyBreakdown"]>;

const PARTS: { key: keyof Omit<Breakdown, "total" | "vacant">; label: string; color: string }[] = [
  { key: "other", label: "放置空き家", color: "bg-bad" },
  { key: "rental", label: "賃貸用", color: "bg-chart-4" },
  { key: "sale", label: "売却用", color: "bg-chart-5" },
  { key: "secondary", label: "二次的住宅（別荘など）", color: "bg-chart-3" },
];

const STATS: { key: MetricKey; note: string }[] = [
  { key: "vacancyRate", note: "空き家数 ÷ 住宅総数" },
  { key: "otherVacancyRate", note: "賃貸・売却用、別荘などを除く空き家 ÷ 住宅総数" },
  { key: "vacancyRateChange", note: "空き家率の前回の調査からの増減" },
];

export function VacancySection({
  area,
  prefecture,
  breakdown,
}: {
  area: AreaMetrics;
  prefecture: string;
  breakdown: AreaDetail["vacancyBreakdown"];
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>空き家</CardTitle>
        <CardDescription>
          住宅・土地統計調査（5 年ごと）から。市と人口 1 万 5 千人以上の町村だけが調査の対象です。
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        <ul className="grid gap-3 sm:grid-cols-3">
          {STATS.map(({ key, note }) => {
            const rank = prefectureRank(area, key);
            const value = area[key];
            return (
              <li key={key} className="flex flex-col gap-1.5 rounded-lg border p-3">
                <p className="text-sm font-medium">{METRICS[key].label}</p>
                <p className="flex flex-wrap items-center gap-2 text-2xl font-bold tabular-nums">
                  {formatMetric(key, value)}
                  {key === "vacancyRateChange" && typeof value === "number" && value !== 0 && (
                    <Chip tone={value > 0 ? "bad" : "good"}>{value > 0 ? "増えた" : "減った"}</Chip>
                  )}
                </p>
                <p className="text-xs text-muted-foreground">{note}</p>
                <p className="text-xs text-muted-foreground">{metricPeriod(key)}</p>
                {rank && (
                  <p className="text-xs text-muted-foreground">
                    {prefecture}内 {rank.total} 市区町村中 {rank.rank} 位（低い順）
                  </p>
                )}
              </li>
            );
          })}
        </ul>
        {breakdown ? (
          <BreakdownBar breakdown={breakdown} />
        ) : (
          <p className="text-sm text-muted-foreground">
            この市区町村は調査の対象外のため、空き家の内訳はありません。
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function BreakdownBar({ breakdown }: { breakdown: Breakdown }) {
  const parts = PARTS.flatMap((part) => {
    const value = breakdown[part.key];
    return value === null ? [] : [{ ...part, value }];
  });
  const share = (value: number) => (breakdown.vacant > 0 ? (value / breakdown.vacant) * 100 : 0);
  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm font-medium">
        空き家 {formatCount(breakdown.vacant, "戸")}の内訳
        <span className="ml-1.5 text-xs font-normal text-muted-foreground">
          住宅総数 {formatCount(breakdown.total, "戸")}・{metricPeriod("vacancyRate")}
        </span>
      </p>
      <div
        className="flex h-3 w-full overflow-hidden rounded-full bg-muted"
        role="img"
        aria-label={parts.map((p) => `${p.label} ${formatPercent(share(p.value))}`).join("、")}
      >
        {parts.map((part) => (
          <div key={part.key} className={part.color} style={{ width: `${share(part.value)}%` }} />
        ))}
      </div>
      <ul className="grid gap-x-6 gap-y-1.5 text-sm sm:grid-cols-2">
        {parts.map((part) => (
          <li key={part.key} className="flex items-center justify-between gap-3">
            <span className="flex items-center gap-2">
              <span aria-hidden className={`size-2.5 rounded-full ${part.color}`} />
              {part.label}
            </span>
            <span className="tabular-nums text-muted-foreground">
              {formatCount(part.value, "戸")}（{formatPercent(share(part.value))}）
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
