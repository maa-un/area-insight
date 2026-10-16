import {
  DISTORTION_THRESHOLD,
  MAX_FILTERS,
  PREFECTURE_CODES,
  prefectureName,
  RELIABLE_TRADE_COUNT,
} from "@area-insight/shared";
import { ArrowDownWideNarrow, ArrowUpNarrowWide, Bookmark, X } from "lucide-react";
import type { ReactNode } from "react";
import { Bar } from "@/components/brand";
import { DataPeriodNote } from "@/components/data-period";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  BASIC_METRICS,
  DISTORTION_METRICS,
  dataset,
  isDistortionMetric,
  isMetricKey,
  isReferenceValue,
  isTradeMetric,
  METRICS,
  type MetricKey,
  rankableAreas,
  sortAreas,
} from "@/data";
import { useAuth } from "@/lib/auth";
import { formatMetric } from "@/lib/format";
import { replaceSearchParams, useSearchParams } from "@/lib/search-params";
import { saveFilters, toggleCompare, useUserData } from "@/lib/user-data";
import { cn } from "@/lib/utils";
import { areaPath } from "@/routes";

// サンプルでは市区町村が少ないため、データのある都道府県だけを選択肢に出す。
const PREFECTURES = PREFECTURE_CODES.filter((code) =>
  dataset.areas.some((area) => area.prefectureCode === code),
);

type Conditions = {
  metric: MetricKey;
  order: "asc" | "desc";
  pref?: string;
  // 参考値（取引件数が閾値未満）の市区町村も含めるか。既定は含めない
  includeReference: boolean;
};

function conditionsOf(params: URLSearchParams): Conditions {
  const metric = params.get("metric");
  const key: MetricKey = isMetricKey(metric) ? metric : "grossYield";
  const order = params.get("order");
  const pref = params.get("pref") ?? undefined;
  return {
    metric: key,
    order:
      order === "asc" || order === "desc" ? order : METRICS[key].better === "low" ? "asc" : "desc",
    pref: pref && PREFECTURE_CODES.includes(pref) ? pref : undefined,
    includeReference: params.get("ref") === "1",
  };
}

function describe(c: Conditions): string {
  const area = c.pref ? prefectureName(c.pref) : "全国";
  const reference = isTradeMetric(c.metric) && c.includeReference ? "（参考値を含む）" : "";
  return `${area}・${METRICS[c.metric].label}の${c.order === "asc" ? "低い" : "高い"}順${reference}`;
}

export function RankingsPage() {
  const conditions = conditionsOf(useSearchParams());
  const { metric, order, pref, includeReference } = conditions;
  const inPrefecture = pref
    ? dataset.areas.filter((a) => a.prefectureCode === pref)
    : dataset.areas;
  const ranked = rankableAreas(inPrefecture, metric, includeReference);
  const hidden = inPrefecture.length - ranked.length;
  const rows = sortAreas(ranked, metric, order);
  // 表の列は基本の指標。歪みの指標を選んだときは、その列を先頭に足す
  const columns = isDistortionMetric(metric) ? [metric, ...BASIC_METRICS] : BASIC_METRICS;
  const max = Math.max(...rows.map((a) => Math.abs(a[metric] ?? 0)), 0);

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight">ランキング</h1>
        <p className="text-muted-foreground">{describe(conditions)}</p>
      </header>

      <div className="flex flex-wrap items-end gap-3">
        <Field label="指標">
          <select
            className={selectClass}
            value={metric}
            onChange={(e) => replaceSearchParams({ metric: e.target.value, order: undefined })}
          >
            <optgroup label="指標">
              {BASIC_METRICS.map((key) => (
                <option key={key} value={key}>
                  {METRICS[key].label}
                </option>
              ))}
            </optgroup>
            <optgroup label="市場の歪み">
              {DISTORTION_METRICS.map((key) => (
                <option key={key} value={key}>
                  {METRICS[key].label}
                </option>
              ))}
            </optgroup>
          </select>
        </Field>
        <Field label="都道府県">
          <select
            className={selectClass}
            value={pref ?? ""}
            onChange={(e) => replaceSearchParams({ pref: e.target.value })}
          >
            <option value="">全国</option>
            {PREFECTURES.map((code) => (
              <option key={code} value={code}>
                {prefectureName(code)}
              </option>
            ))}
          </select>
        </Field>
        <Button
          variant="outline"
          onClick={() => replaceSearchParams({ order: order === "asc" ? "desc" : "asc" })}
        >
          {order === "asc" ? <ArrowUpNarrowWide /> : <ArrowDownWideNarrow />}
          {order === "asc" ? "低い順" : "高い順"}
        </Button>
        <SavedFilters current={conditions} />
      </div>

      <DataPeriodNote sources={METRICS[metric].sources} />

      {isDistortionMetric(metric) && (
        <p className="text-sm text-muted-foreground">
          {metric === "landToOfficialRatio"
            ? "土地の取引単価の中央値 ÷ 住宅地の地価（公示地価・基準地価）の中央値。1 倍を下回るほど、公的な評価より安く取引されています。"
            : `需要の指標と価格の指標の、都道府県内での順位の差（-100〜+100pt）。+${DISTORTION_THRESHOLD}pt 以上を「歪みあり」としています。`}{" "}
          取引の少ない市区町村と、「利回りは高いが人口が減り空き家も多い」市区町村は載せていません。投資判断の助言ではありません。
        </p>
      )}

      {isTradeMetric(metric) && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              className="size-4 accent-primary"
              checked={includeReference}
              onChange={(e) => replaceSearchParams({ ref: e.target.checked ? "1" : undefined })}
            />
            参考値も含める
          </label>
          <span className="text-xs text-muted-foreground">
            {includeReference
              ? `取引 ${RELIABLE_TRADE_COUNT} 件未満の市区町村（参考値）も並べています`
              : `取引 ${RELIABLE_TRADE_COUNT} 件未満の ${hidden.toLocaleString("ja-JP")} 市区町村（参考値）を除いています`}
          </span>
        </div>
      )}

      <div className="overflow-x-auto rounded-xl border">
        <table className="w-full min-w-[760px] text-sm">
          <thead className="bg-muted/50 text-left text-muted-foreground">
            <tr>
              <th className="w-12 px-3 py-2.5 font-medium">順位</th>
              <th className="px-3 py-2.5 font-medium">市区町村</th>
              {columns.map((key) => (
                <th key={key} className="px-3 py-2.5 text-right font-medium">
                  <button
                    type="button"
                    className={cn("hover:text-foreground", key === metric && "text-foreground")}
                    onClick={() => replaceSearchParams({ metric: key, order: undefined })}
                  >
                    {METRICS[key].label}
                  </button>
                </th>
              ))}
              <th className="px-3 py-2.5">
                <span className="sr-only">比較</span>
              </th>
            </tr>
          </thead>
          <tbody className="tabular-nums">
            {rows.map((area, i) => (
              <tr key={area.code} className="border-t hover:bg-muted/30">
                <td
                  className={cn(
                    "px-3 py-2.5 font-bold tabular-nums",
                    i < 3 ? "text-terracotta" : "text-muted-foreground",
                  )}
                >
                  {area[metric] === null ? "—" : i + 1}
                </td>
                <td className="px-3 py-2.5">
                  <a href={areaPath(area.code)} className="font-medium hover:underline">
                    {area.name}
                  </a>
                  <span className="ml-1.5 text-xs text-muted-foreground">
                    {prefectureName(area.prefectureCode)}
                  </span>
                </td>
                {columns.map((key) => (
                  <td
                    key={key}
                    className={cn(
                      "px-3 py-2.5 text-right whitespace-nowrap",
                      key === metric && "font-bold",
                    )}
                  >
                    {formatMetric(key, area[key])}
                    {isTradeMetric(key) && area[key] !== null && isReferenceValue(area, key) && (
                      <Badge variant="outline" className="ml-1.5">
                        参考値
                      </Badge>
                    )}
                    {key === metric && (
                      <Bar
                        value={Math.abs(area[key] ?? 0)}
                        max={max}
                        highlight={i < 3}
                        className="mt-1.5 ml-auto w-24"
                      />
                    )}
                  </td>
                ))}
                <td className="px-3 py-2.5 text-right">
                  <CompareToggle code={area.code} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const selectClass =
  "h-9 rounded-md border border-input bg-background px-3 text-sm shadow-xs focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none";

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    // biome-ignore lint/a11y/noLabelWithoutControl: 子要素の select を包んで関連付けている
    <label className="flex flex-col gap-1 text-xs text-muted-foreground">
      {label}
      {children}
    </label>
  );
}

function CompareToggle({ code }: { code: string }) {
  const { compare } = useUserData();
  const added = compare.includes(code);
  return (
    <Button size="sm" variant={added ? "secondary" : "ghost"} onClick={() => toggleCompare(code)}>
      {added ? "比較中" : "比較に追加"}
    </Button>
  );
}

// 絞り込み条件の保存（ログインが必要）。ログイン機能が無い環境では出さない。
function SavedFilters({ current }: { current: Conditions }) {
  const auth = useAuth();
  const { filters } = useUserData();
  if (auth.status === "disabled") return null;

  const add = () => {
    const name = describe(current);
    if (filters.some((f) => f.name === name)) return;
    const conditions: Record<string, string> = { metric: current.metric, order: current.order };
    if (current.pref) conditions.pref = current.pref;
    if (current.includeReference) conditions.ref = "1";
    saveFilters([...filters, { name, conditions }].slice(-MAX_FILTERS));
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button variant="ghost" onClick={add} disabled={auth.status === "loading"}>
        <Bookmark />
        この条件を保存
      </Button>
      {filters.map((filter) => (
        <span key={filter.name} className="flex items-center rounded-full border text-xs">
          <button
            type="button"
            className="py-1 pr-1 pl-3 hover:underline"
            onClick={() =>
              replaceSearchParams({
                metric: String(filter.conditions.metric ?? ""),
                order: String(filter.conditions.order ?? ""),
                pref: String(filter.conditions.pref ?? ""),
                ref: String(filter.conditions.ref ?? ""),
              })
            }
          >
            {filter.name}
          </button>
          <button
            type="button"
            aria-label={`${filter.name}を削除`}
            className="rounded-full p-1 text-muted-foreground hover:text-foreground"
            onClick={() => saveFilters(filters.filter((f) => f.name !== filter.name))}
          >
            <X className="size-3" />
          </button>
        </span>
      ))}
    </div>
  );
}
