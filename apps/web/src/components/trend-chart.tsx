import { type AreaDetail, RELIABLE_TRADE_COUNT } from "@area-insight/shared";
import { useState } from "react";
import { formatManYen, formatQuarter } from "@/lib/format";
import { cn } from "@/lib/utils";

// 取引価格（中央値）の推移の折れ線。四半期と年を切り替えられる。グラフのライブラリは使わず SVG で描く。
// 件数が少ない点は値が振れるため、白抜きの点で「参考値」と分かるようにする。
const W = 640;
const H = 240;
const PAD = { top: 16, right: 16, bottom: 32, left: 56 };

type Point = {
  key: string;
  // 横軸の目盛りに出す文字。出さない点は undefined
  axisLabel?: string;
  // ツールチップに出す期間の名前
  name: string;
  price: number | null;
  count: number;
};

type View = "quarter" | "year";

function niceTicks(min: number, max: number, count = 4): number[] {
  const span = max - min || max || 1;
  const raw = span / count;
  const step = 10 ** Math.floor(Math.log10(raw));
  const nice = [1, 2, 2.5, 5, 10].map((m) => m * step).find((s) => s >= raw) ?? raw;
  const start = Math.floor(min / nice) * nice;
  const ticks: number[] = [];
  for (let v = start; v <= max + nice / 2; v += nice) ticks.push(Math.round(v));
  return ticks;
}

// 途中の年（最新の四半期が第 4 四半期でない年）には、どこまでの値かを添える。
export function yearName(year: number, latestQuarter: string | undefined): string {
  const latestYear = Number(latestQuarter?.slice(0, 4));
  const latestQ = Number(latestQuarter?.slice(5));
  if (year === latestYear && latestQ > 0 && latestQ < 4) return `${year}年（${latestQ * 3}月まで）`;
  return `${year}年`;
}

export function TrendChart({
  quarters,
  years,
}: {
  quarters: AreaDetail["quarters"];
  years: AreaDetail["years"];
}) {
  const [view, setView] = useState<View>("quarter");
  const latest = quarters.at(-1)?.period;

  const series: Record<View, { points: Point[]; lowCount: number; legend: string }> = {
    quarter: {
      points: quarters.map((q) => ({
        key: q.period,
        axisLabel: q.period.endsWith("Q1") ? q.period.slice(0, 4) : undefined,
        name: formatQuarter(q.period),
        price: q.price,
        count: q.count,
      })),
      lowCount: 3,
      legend: "四半期の中央値",
    },
    year: {
      points: years.map((y) => ({
        key: String(y.year),
        axisLabel: String(y.year),
        name: yearName(y.year, latest),
        price: y.price,
        count: y.count,
      })),
      lowCount: RELIABLE_TRADE_COUNT,
      legend: "年の中央値",
    },
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-1 self-start rounded-lg bg-muted p-1 text-xs" role="tablist">
        {(["quarter", "year"] as const).map((v) => (
          <button
            key={v}
            type="button"
            role="tab"
            aria-selected={view === v}
            className={cn(
              "rounded-md px-3 py-1 transition-colors",
              view === v ? "bg-background font-medium shadow-xs" : "text-muted-foreground",
            )}
            onClick={() => setView(v)}
          >
            {v === "quarter" ? "四半期" : "年"}
          </button>
        ))}
      </div>
      <Series {...series[view]} />
    </div>
  );
}

function Series({
  points,
  lowCount,
  legend,
}: {
  points: Point[];
  lowCount: number;
  legend: string;
}) {
  const values = points.flatMap((p) => (p.price === null ? [] : [p.price]));
  if (values.length < 2) {
    return <p className="text-sm text-muted-foreground">推移を描けるだけの取引がありません。</p>;
  }
  const ticks = niceTicks(Math.min(...values) * 0.9, Math.max(...values) * 1.05);
  const yMin = ticks[0] ?? 0;
  const yMax = ticks.at(-1) ?? 1;
  const x = (i: number) =>
    PAD.left + (points.length === 1 ? 0.5 : i / (points.length - 1)) * (W - PAD.left - PAD.right);
  const y = (v: number) => PAD.top + (1 - (v - yMin) / (yMax - yMin)) * (H - PAD.top - PAD.bottom);

  // 値の無い点で線を切る。
  const segments: string[] = [];
  let current = "";
  points.forEach((p, i) => {
    if (p.price === null) {
      if (current) segments.push(current);
      current = "";
      return;
    }
    current += `${current ? "L" : "M"}${x(i).toFixed(1)},${y(p.price).toFixed(1)}`;
  });
  if (current) segments.push(current);

  return (
    <figure className="flex flex-col gap-2">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="h-auto w-full text-primary"
        role="img"
        aria-label={`${legend}の推移`}
      >
        {ticks.map((t) => (
          <g key={t}>
            <line
              x1={PAD.left}
              x2={W - PAD.right}
              y1={y(t)}
              y2={y(t)}
              className="stroke-border"
              strokeWidth={1}
            />
            <text
              x={PAD.left - 8}
              y={y(t)}
              textAnchor="end"
              dominantBaseline="middle"
              className="fill-muted-foreground text-[11px] tabular-nums"
            >
              {t.toLocaleString("ja-JP")}
            </text>
          </g>
        ))}
        {points.map((p, i) =>
          p.axisLabel ? (
            <text
              key={p.key}
              x={x(i)}
              y={H - 10}
              textAnchor="middle"
              className="fill-muted-foreground text-[11px] tabular-nums"
            >
              {p.axisLabel}
            </text>
          ) : null,
        )}
        <text x={8} y={PAD.top} className="fill-muted-foreground text-[11px]">
          万円
        </text>
        {segments.map((d) => (
          <path key={d} d={d} fill="none" stroke="currentColor" strokeWidth={2} />
        ))}
        {points.map((p, i) =>
          p.price === null ? null : (
            <circle
              key={p.key}
              cx={x(i)}
              cy={y(p.price)}
              r={3.5}
              strokeWidth={1.5}
              stroke="currentColor"
              className={p.count < lowCount ? "fill-background" : "fill-current"}
            >
              <title>{`${p.name}: ${formatManYen(p.price)}（${p.count}件）`}</title>
            </circle>
          ),
        )}
      </svg>
      <figcaption className="flex items-center gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="inline-block size-2.5 rounded-full bg-primary" aria-hidden />
          {legend}
        </span>
        <span className="flex items-center gap-1.5">
          <span
            className="inline-block size-2.5 rounded-full border-[1.5px] border-primary"
            aria-hidden
          />
          取引 {lowCount} 件未満（参考値）
        </span>
      </figcaption>
    </figure>
  );
}
