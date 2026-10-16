import {
  type AreaMetrics,
  MAX_COMPARE,
  MunicipalityCode,
  prefectureName,
  RELIABLE_TRADE_COUNT,
} from "@area-insight/shared";
import { ArrowUpRight, Columns3, Plus, Trophy, X } from "lucide-react";
import { useEffect } from "react";
import { PageHeader } from "@/components/brand";
import { openSearch } from "@/components/search-dialog";
import { Button } from "@/components/ui/button";
import { findArea, METRICS, type MetricKey, metricPeriod } from "@/data";
import { formatCount, formatMetric } from "@/lib/format";
import { propfolioUrl } from "@/lib/propfolio";
import { replaceSearchParams, useSearchParams } from "@/lib/search-params";
import { setCompare, useUserData } from "@/lib/user-data";
import { cn } from "@/lib/utils";
import { areaPath } from "@/routes";

const ROWS = Object.keys(METRICS) as MetricKey[];
// 比較の空き枠。並びが変わらないので枠の名前を key にする。
const SLOTS = Array.from({ length: MAX_COMPARE }, (_, i) => `slot-${i + 1}`);

// URL の ?codes= を優先し、無ければ保存中の比較リストを使う。URL で共有された比較を開くと、
// それが比較リストになる。
function useCompareCodes(): string[] {
  const params = useSearchParams();
  const { compare } = useUserData();
  const fromUrl = (params.get("codes") ?? "")
    .split(",")
    .filter((code) => MunicipalityCode.safeParse(code).success && findArea(code))
    .slice(0, MAX_COMPARE);
  const codes = fromUrl.length ? fromUrl : compare;

  const urlKey = fromUrl.join(",");
  const compareKey = compare.join(",");
  useEffect(() => {
    if (urlKey && urlKey !== compareKey) setCompare(urlKey.split(","));
  }, [urlKey, compareKey]);
  return codes;
}

function best(key: MetricKey, areas: AreaMetrics[]): number | undefined {
  const values = areas.flatMap((a) => (a[key] === null ? [] : [a[key]]));
  if (values.length < 2) return undefined;
  return METRICS[key].better === "low" ? Math.min(...values) : Math.max(...values);
}

export function ComparePage() {
  const codes = useCompareCodes();
  const areas = codes.flatMap((code) => {
    const area = findArea(code);
    return area ? [area] : [];
  });

  const remove = (code: string) => {
    const next = codes.filter((c) => c !== code);
    setCompare(next);
    replaceSearchParams({ codes: next.join(",") });
  };

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        icon={Columns3}
        eyebrow={`${areas.length} / ${MAX_COMPARE}`}
        title="比較"
        description={`市区町村を ${MAX_COMPARE} つまで横に並べて比べます。良い方の値を色付きの太字にしています。`}
      />

      {areas.length === 0 ? (
        <div className="relative flex flex-col items-center gap-4 overflow-hidden rounded-3xl border border-dashed bg-card px-6 py-16 text-center animate-rise [animation-delay:80ms]">
          <div className="relative">
            <span className="absolute inset-0 animate-ping rounded-2xl bg-primary/20 [animation-duration:2.4s]" />
            <span className="relative flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <Columns3 className="size-7" aria-hidden />
            </span>
          </div>
          <div className="flex flex-col gap-1">
            <h2 className="text-lg">比較する市区町村がありません</h2>
            <p className="text-sm text-muted-foreground">
              市区町村ページやランキングの「比較に追加」から選んでください。
            </p>
          </div>
          <div className="flex flex-wrap justify-center gap-2">
            <Button onClick={openSearch}>
              <Plus />
              市区町村を探す
            </Button>
            <Button asChild variant="outline">
              <a href="/rankings/">ランキングから選ぶ</a>
            </Button>
          </div>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border bg-card animate-rise [animation-delay:80ms]">
          <table className="w-full min-w-[560px] table-fixed text-sm">
            <thead>
              <tr className="bg-muted/40">
                <th className="w-40 px-4 py-3 text-left font-medium text-muted-foreground">指標</th>
                {areas.map((area, i) => (
                  <th
                    key={area.code}
                    className="px-4 py-3 text-left align-top animate-in fade-in slide-in-from-top-2 fill-mode-both duration-500"
                    style={{ animationDelay: `${i * 80}ms` }}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <a
                          href={areaPath(area.code)}
                          className="text-base font-bold transition-colors hover:text-primary"
                        >
                          {area.name}
                        </a>
                        <p className="text-xs font-normal text-muted-foreground">
                          {prefectureName(area.prefectureCode)}
                        </p>
                      </div>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="size-7"
                        aria-label={`${area.name}を比較から外す`}
                        onClick={() => remove(area.code)}
                      >
                        <X />
                      </Button>
                    </div>
                  </th>
                ))}
                {SLOTS.slice(areas.length).map((slot) => (
                  <th key={slot} className="px-4 py-3 text-left font-normal text-muted-foreground">
                    <button
                      type="button"
                      onClick={openSearch}
                      className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed py-2 text-xs transition-colors hover:border-primary/50 hover:bg-accent hover:text-primary"
                    >
                      <Plus className="size-3.5" />
                      追加する
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="tabular-nums">
              {ROWS.map((key) => {
                const top = best(key, areas);
                return (
                  <tr key={key} className="border-t transition-colors hover:bg-muted/30">
                    <th
                      scope="row"
                      className="px-4 py-3 text-left font-normal text-muted-foreground"
                    >
                      {METRICS[key].label}
                      <span className="block text-[11px]">{metricPeriod(key)}</span>
                    </th>
                    {areas.map((area) => (
                      <td
                        key={area.code}
                        className={cn(
                          "px-4 py-3",
                          area[key] === top && "font-bold text-terracotta",
                        )}
                      >
                        <span className="inline-flex items-center gap-1.5">
                          {formatMetric(key, area[key])}
                          {area[key] === top && (
                            <Trophy
                              className="size-3.5 animate-in zoom-in"
                              aria-label="最も良い値"
                            />
                          )}
                        </span>
                      </td>
                    ))}
                    {SLOTS.slice(areas.length).map((slot) => (
                      <td key={slot} />
                    ))}
                  </tr>
                );
              })}
              <tr className="border-t">
                <th scope="row" className="px-4 py-3 text-left font-normal text-muted-foreground">
                  取引件数
                </th>
                {areas.map((area) => (
                  <td key={area.code} className="px-4 py-3">
                    {formatCount(area.tradeCount, "件")}
                    {area.tradeCount < RELIABLE_TRADE_COUNT && (
                      <span className="ml-1 text-xs text-muted-foreground">（参考値）</span>
                    )}
                  </td>
                ))}
                {SLOTS.slice(areas.length).map((slot) => (
                  <td key={slot} />
                ))}
              </tr>
              <tr className="border-t">
                <td className="px-4 py-3" />
                {areas.map((area) => (
                  <td key={area.code} className="px-4 py-3">
                    <Button asChild size="sm" className="w-full">
                      <a href={propfolioUrl(area)} target="_blank" rel="noopener">
                        収支を計算
                        <ArrowUpRight />
                      </a>
                    </Button>
                  </td>
                ))}
                {SLOTS.slice(areas.length).map((slot) => (
                  <td key={slot} />
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      )}
      <LoginHint />
    </div>
  );
}

function LoginHint() {
  const { synced } = useUserData();
  if (synced) return null;
  return (
    <p className="text-xs text-muted-foreground">
      比較リストはこのブラウザに残ります。ログインすると別の端末でも使えるよう保存されます。
    </p>
  );
}
