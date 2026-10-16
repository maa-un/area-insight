import type { DataPeriod, DataPeriodKey } from "@area-insight/shared";
import { CalendarClock } from "lucide-react";
import { dataset } from "@/data";
import { formatDataPeriod } from "@/lib/format";
import { cn } from "@/lib/utils";

// 数字の元データの時点（仕様書「時点の表示ルール」）。数字のすぐ近くに「出典・時点」を短く出す。
// 組み合わせた指標（利回り、歪み）は元データごとに並べ、時点が 2 年以上離れていれば注記する。

// 時点が離れていると注記する年数。
const GAP_YEARS = 2;

export function periodEntries(sources: readonly DataPeriodKey[]): DataPeriod[] {
  // 同じ出典・同じ時点（例: 空き家と家賃の住宅・土地統計調査）は 1 つにまとめる
  const seen = new Set<string>();
  return sources.flatMap((key) => {
    const period = dataset.periods[key];
    if (!period) return [];
    const id = `${period.source}|${period.from}|${period.to}`;
    if (seen.has(id)) return [];
    seen.add(id);
    return [period];
  });
}

// 元データの時点の差が GAP_YEARS 年以上あるか。期間のデータは終わりの日で比べる。
export function periodsDiverge(periods: readonly DataPeriod[]): boolean {
  const years = periods.map((p) => Number(p.to.slice(0, 4)));
  return years.length > 1 && Math.max(...years) - Math.min(...years) >= GAP_YEARS;
}

export function DataPeriodNote({
  sources,
  className,
}: {
  sources: readonly DataPeriodKey[];
  className?: string;
}) {
  const periods = periodEntries(sources);
  if (periods.length === 0) return null;
  return (
    <p className={cn("flex items-start gap-1.5 text-xs text-muted-foreground", className)}>
      <CalendarClock className="mt-px size-3.5 shrink-0" aria-hidden />
      <span>
        {periods.map((p) => `${p.source} ${formatDataPeriod(p)}`).join("・")}
        {periodsDiverge(periods) && (
          <span className="ml-1 text-[#8f3c1c]">（元データの時点がずれています）</span>
        )}
      </span>
    </p>
  );
}
