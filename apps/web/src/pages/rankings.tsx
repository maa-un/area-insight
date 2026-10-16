import {
  DISTORTION_THRESHOLD,
  MAX_FILTERS,
  PREFECTURE_CODES,
  prefectureName,
  RELIABLE_TRADE_COUNT,
} from "@area-insight/shared";
import {
  ArrowDownWideNarrow,
  ArrowUpNarrowWide,
  Bookmark,
  Check,
  ListOrdered,
  Plus,
  X,
} from "lucide-react";
import type { CSSProperties, ReactNode } from "react";
import { Bar, PageHeader } from "@/components/brand";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
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
  metricPeriod,
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
      <PageHeader
        icon={ListOrdered}
        eyebrow={`${rows.length.toLocaleString("ja-JP")} 市区町村`}
        title="ランキング"
        description={describe(conditions)}
      />

      <div className="sticky top-14 z-20 -mx-4 flex flex-wrap items-end gap-3 border-y bg-background/85 px-4 py-3 backdrop-blur-xl animate-rise [animation-delay:80ms] sm:mx-0 sm:rounded-2xl sm:border sm:bg-card/85 lg:top-4">
        <Field label="指標">
          <Select
            value={metric}
            onValueChange={(value) => replaceSearchParams({ metric: value, order: undefined })}
          >
            <SelectTrigger className="h-9 min-w-48 bg-background">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectLabel>指標</SelectLabel>
                {BASIC_METRICS.map((key) => (
                  <SelectItem key={key} value={key}>
                    {METRICS[key].label}
                  </SelectItem>
                ))}
              </SelectGroup>
              <SelectGroup>
                <SelectLabel>市場の歪み</SelectLabel>
                {DISTORTION_METRICS.map((key) => (
                  <SelectItem key={key} value={key}>
                    {METRICS[key].label}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </Field>
        <Field label="都道府県">
          <Select
            value={pref ?? ALL}
            onValueChange={(value) => replaceSearchParams({ pref: value === ALL ? "" : value })}
          >
            <SelectTrigger className="h-9 min-w-32 bg-background">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>全国</SelectItem>
              {PREFECTURES.map((code) => (
                <SelectItem key={code} value={code}>
                  {prefectureName(code)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Button
          variant="outline"
          className="h-9 bg-background"
          onClick={() => replaceSearchParams({ order: order === "asc" ? "desc" : "asc" })}
        >
          <span key={order} className="flex animate-in spin-in-90 fade-in duration-300">
            {order === "asc" ? <ArrowUpNarrowWide /> : <ArrowDownWideNarrow />}
          </span>
          {order === "asc" ? "低い順" : "高い順"}
        </Button>
        <SavedFilters current={conditions} />
      </div>

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
          <label htmlFor="include-reference" className="flex items-center gap-2 font-medium">
            <Switch
              id="include-reference"
              checked={includeReference}
              onCheckedChange={(checked) => replaceSearchParams({ ref: checked ? "1" : undefined })}
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

      <div className="overflow-x-auto rounded-2xl border bg-card animate-rise [animation-delay:160ms]">
        <table className="w-full min-w-[760px] text-sm">
          <thead className="border-b bg-muted/40 text-left text-xs text-muted-foreground">
            <tr>
              <th className="w-12 px-3 py-2.5 font-medium">順位</th>
              <th className="px-3 py-3 font-medium">市区町村</th>
              {columns.map((key) => (
                <th key={key} className="px-3 py-3 text-right font-medium">
                  <button
                    type="button"
                    className={cn(
                      "rounded-md px-1 py-0.5 text-right transition-colors hover:bg-muted hover:text-foreground",
                      key === metric && "text-primary",
                    )}
                    onClick={() => replaceSearchParams({ metric: key, order: undefined })}
                  >
                    {METRICS[key].label}
                    <span className="block text-[11px] font-normal text-muted-foreground">
                      {metricPeriod(key)}
                    </span>
                  </button>
                </th>
              ))}
              <th className="px-3 py-3">
                <span className="sr-only">比較</span>
              </th>
            </tr>
          </thead>
          <tbody className="tabular-nums">
            {rows.map((area, i) => (
              <tr
                key={`${metric}-${order}-${area.code}`}
                className="stagger group border-t transition-colors hover:bg-accent/50"
                style={{ "--i": i } as CSSProperties}
              >
                <td className="px-3 py-3">
                  {area[metric] === null ? (
                    <span className="text-muted-foreground">—</span>
                  ) : (
                    <span
                      className={cn(
                        "flex size-7 items-center justify-center rounded-full text-xs font-bold tabular-nums",
                        i < 3
                          ? "bg-primary text-primary-foreground shadow-sm shadow-primary/30"
                          : "bg-muted text-muted-foreground",
                      )}
                    >
                      {i + 1}
                    </span>
                  )}
                </td>
                <td className="px-3 py-3">
                  <a
                    href={areaPath(area.code)}
                    className="font-semibold transition-colors group-hover:text-primary"
                  >
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
                <td className="px-3 py-3 text-right">
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

// Radix の Select は空文字を値にできないため、「全国」を表す値を別に持つ
const ALL = "all";

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
      {label}
      {children}
    </div>
  );
}

function CompareToggle({ code }: { code: string }) {
  const { compare } = useUserData();
  const added = compare.includes(code);
  return (
    <Button
      size="sm"
      variant={added ? "secondary" : "ghost"}
      className={cn(added && "text-primary")}
      onClick={() => toggleCompare(code)}
    >
      {added ? <Check className="animate-in zoom-in" /> : <Plus />}
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
