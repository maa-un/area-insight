import type { AreaDetail } from "@area-insight/shared";
import { formatManYen, formatQuarter } from "@/lib/format";

// 四半期ごとの取引価格（中央値）の折れ線。グラフのライブラリは使わず SVG で描く。
// 件数が少ない四半期は値が振れるため、白抜きの点で「参考値」と分かるようにする。
const LOW_COUNT = 3;
const W = 640;
const H = 240;
const PAD = { top: 16, right: 16, bottom: 32, left: 56 };

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

export function TrendChart({ quarters }: { quarters: AreaDetail["quarters"] }) {
  const values = quarters.flatMap((q) => (q.price === null ? [] : [q.price]));
  if (values.length < 2) {
    return <p className="text-sm text-muted-foreground">推移を描けるだけの取引がありません。</p>;
  }
  const ticks = niceTicks(Math.min(...values) * 0.9, Math.max(...values) * 1.05);
  const yMin = ticks[0] ?? 0;
  const yMax = ticks.at(-1) ?? 1;
  const x = (i: number) => PAD.left + (i / (quarters.length - 1)) * (W - PAD.left - PAD.right);
  const y = (v: number) => PAD.top + (1 - (v - yMin) / (yMax - yMin)) * (H - PAD.top - PAD.bottom);

  // 値の無い四半期で線を切る。
  const segments: string[] = [];
  let current = "";
  quarters.forEach((q, i) => {
    if (q.price === null) {
      if (current) segments.push(current);
      current = "";
      return;
    }
    current += `${current ? "L" : "M"}${x(i).toFixed(1)},${y(q.price).toFixed(1)}`;
  });
  if (current) segments.push(current);

  return (
    <figure className="flex flex-col gap-2">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="h-auto w-full text-primary"
        role="img"
        aria-label="四半期ごとの取引価格（中央値）の推移"
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
        {quarters.map((q, i) =>
          q.period.endsWith("Q1") ? (
            <text
              key={q.period}
              x={x(i)}
              y={H - 10}
              textAnchor="middle"
              className="fill-muted-foreground text-[11px] tabular-nums"
            >
              {q.period.slice(0, 4)}
            </text>
          ) : null,
        )}
        <text x={8} y={PAD.top} className="fill-muted-foreground text-[11px]">
          万円
        </text>
        {segments.map((d) => (
          <path key={d} d={d} fill="none" stroke="currentColor" strokeWidth={2} />
        ))}
        {quarters.map((q, i) =>
          q.price === null ? null : (
            <circle
              key={q.period}
              cx={x(i)}
              cy={y(q.price)}
              r={3.5}
              strokeWidth={1.5}
              stroke="currentColor"
              className={q.count < LOW_COUNT ? "fill-background" : "fill-current"}
            >
              <title>{`${formatQuarter(q.period)}: ${formatManYen(q.price)}（${q.count}件）`}</title>
            </circle>
          ),
        )}
      </svg>
      <figcaption className="flex items-center gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="inline-block size-2.5 rounded-full bg-primary" aria-hidden />
          四半期の中央値
        </span>
        <span className="flex items-center gap-1.5">
          <span
            className="inline-block size-2.5 rounded-full border-[1.5px] border-primary"
            aria-hidden
          />
          取引 {LOW_COUNT} 件未満（参考値）
        </span>
      </figcaption>
    </figure>
  );
}
