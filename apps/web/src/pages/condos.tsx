import { type CondoFile, prefectureName } from "@area-insight/shared";
import {
  ArrowLeft,
  Building2,
  Calculator,
  Info,
  Loader2,
  MousePointerClick,
  RotateCcw,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { BasemapSwitcher } from "@/components/basemap-switcher";
import { Pager } from "@/components/pager";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { dataset } from "@/data";
import { condoPrefectures, loadCondos } from "@/data/condos";
import { readStoredBasemap } from "@/lib/basemaps";
import {
  type CondoFilters,
  DEFAULT_FILTERS,
  filtersFromParams,
  filtersToParams,
  filterTrades,
  KINDS,
  type KindFilter,
  PERIOD_YEARS,
  PLAN_GROUPS,
  type PlanGroup,
  perTsubo,
  priceFor,
  type Summary,
  stationLabel,
  summarize,
  summarizeByStation,
  type Trade,
  toTrade,
} from "@/lib/condos";
import {
  formatCount,
  formatLines,
  formatManYen,
  formatManYenPerSqm,
  formatManYenPerTsubo,
  formatQuarter,
  formatTsuboRange,
} from "@/lib/format";
import type { MapController, PopupContent } from "@/lib/map-engine";
import { quantileScale, SCALE_COLORS } from "@/lib/map-scale";
import { clampPage, pageSlice } from "@/lib/pagination";
import { formatDataPeriod } from "@/lib/period";
import { replaceSearchParams, useSearchParams } from "@/lib/search-params";
import { cn } from "@/lib/utils";

// マンションの成約事例（仕入れ値の参考）。都道府県を選ぶと、その都道府県のマンションの取引を
// 最寄り駅ごとに地図へ置き、間取り・面積・築年数・時期で絞り込んで坪単価の分布を出す。
// 取引は XPT001（中古マンション等）の取引価格と成約価格。位置は最寄り駅で、駅からの距離は公表されていない。

const DEFAULT_PREFECTURE = "13";
const AREA_STEPS = [20, 30, 40, 50, 60, 70, 80, 100];
const AGE_STEPS = [5, 10, 15, 20, 25, 30, 40];
// 駅の一覧・取引の一覧で最初に出す数。残りは「もっと見る」で開く
const SHOWN_STATIONS = 10;
const SHOWN_TRADES = 20;
const ANY = "any";

type Status = "loading" | "loaded" | "failed";
type StationOrder = "count" | "cheap";

export function CondosPage() {
  const params = useSearchParams();
  const filters = filtersFromParams(params);
  const prefParam = params.get("pref") ?? "";
  const prefecture = condoPrefectures.includes(prefParam)
    ? prefParam
    : condoPrefectures.includes(DEFAULT_PREFECTURE)
      ? DEFAULT_PREFECTURE
      : (condoPrefectures[0] ?? DEFAULT_PREFECTURE);

  const [file, setFile] = useState<CondoFile | null>(null);
  const [status, setStatus] = useState<Status>("loading");
  const [selected, setSelected] = useState<number | null>(null);
  const [ready, setReady] = useState(false);
  const container = useRef<HTMLDivElement>(null);
  const controller = useRef<MapController | null>(null);

  const setFilters = (next: Partial<CondoFilters>) =>
    replaceSearchParams(filtersToParams({ ...filters, ...next }));

  // 選んだ都道府県のファイルを取りに行く。切り替えたら駅の選択を外す
  useEffect(() => {
    let cancelled = false;
    setStatus("loading");
    setSelected(null);
    loadCondos(prefecture).then(
      (loaded) => {
        if (cancelled) return;
        setFile(loaded);
        setStatus("loaded");
      },
      () => !cancelled && setStatus("failed"),
    );
    return () => {
      cancelled = true;
    };
  }, [prefecture]);

  // 地図の生成は 1 回だけ。市区町村の境界は使わない
  useEffect(() => {
    const node = container.current;
    if (!node) return;
    let cancelled = false;
    void import("@/lib/map-engine").then(async ({ createMap }) => {
      const map = await createMap(node, {
        areas: false,
        basemap: readStoredBasemap(),
        onSelect: (selection) => {
          if (selection?.layer === "condos") setSelected(Number(selection.properties.station));
        },
      });
      if (cancelled) {
        map.destroy();
        return;
      }
      controller.current = map;
      setReady(true);
    });
    return () => {
      cancelled = true;
      controller.current?.destroy();
      controller.current = null;
    };
  }, []);

  const trades = useMemo(() => (file ? file.trades.map((row, i) => toTrade(row, i)) : []), [file]);
  const filterKey = JSON.stringify(filters);
  // biome-ignore lint/correctness/useExhaustiveDependencies: filters は毎回作り直すため、中身（filterKey）で比べる
  const filtered = useMemo(() => filterTrades(trades, filters), [trades, filterKey]);
  const byStation = useMemo(() => summarizeByStation(filtered), [filtered]);
  const scale = useMemo(
    () => quantileScale([...byStation.values()].map((s) => s.median)),
    [byStation],
  );

  // 都道府県を切り替えたら、取引のある駅が収まるように寄せる
  useEffect(() => {
    if (!ready || !file || file.stations.length === 0) return;
    const used = new Set(file.trades.map((t) => t[0]));
    const points = file.stations.filter((_, i) => used.has(i)).map((s) => s.coordinates);
    const lngs = points.map((p) => p[0]);
    const lats = points.map((p) => p[1]);
    controller.current?.fitBounds([
      Math.min(...lngs),
      Math.min(...lats),
      Math.max(...lngs),
      Math.max(...lats),
    ]);
  }, [ready, file]);

  useEffect(() => {
    if (!ready) return;
    controller.current?.setPoints(
      "condos",
      file
        ? [...byStation].map(([station, summary]) => ({
            coordinates: file.stations[station]?.coordinates ?? [0, 0],
            properties: {
              station,
              color: scale.colorOf(summary.median),
              // 件数の平方根で大きさを決め、件数の多い駅が地図を覆わないようにする
              size: Math.min(18, 4 + Math.sqrt(summary.count) * 1.2),
              selected: station === selected ? 1 : 0,
            },
          }))
        : [],
    );
  }, [ready, file, byStation, scale, selected]);

  // 選んだ駅の吹き出し。駅を選び直したときに開き、条件を変えたときは開いていれば中身だけ差し替える
  const popup = useMemo<PopupContent | null>(() => {
    if (selected === null || !file) return null;
    const summary = byStation.get(selected);
    return {
      title: stationName(file, selected),
      lines: summary
        ? [
            `坪単価（中央値） ${formatManYenPerTsubo(summary.median)}`,
            formatCount(summary.count, "件"),
          ]
        : ["条件に合う取引はありません"],
    };
  }, [file, byStation, selected]);
  const popupRef = useRef(popup);
  popupRef.current = popup;

  useEffect(() => {
    if (!ready) return;
    const coordinates = selected === null ? undefined : file?.stations[selected]?.coordinates;
    const content = popupRef.current;
    if (coordinates && content) controller.current?.showPopup(coordinates, content);
    else controller.current?.closePopup();
  }, [ready, file, selected]);

  useEffect(() => {
    if (ready && popup) controller.current?.updatePopup(popup);
  }, [ready, popup]);

  const station = selected === null ? null : (file?.stations[selected] ?? null);
  const scopeTrades = useMemo(
    () => (selected === null ? filtered : filtered.filter((t) => t.station === selected)),
    [filtered, selected],
  );
  const summary = useMemo(() => summarize(scopeTrades), [scopeTrades]);

  return (
    <div className="flex flex-col lg:h-svh lg:flex-row">
      <aside className="order-2 flex flex-col gap-5 border-t bg-background p-5 lg:order-1 lg:w-[22rem] xl:w-[26rem] lg:overflow-y-auto lg:border-t-0 lg:border-r">
        <div className="animate-rise">
          <p className="mb-2 flex items-center gap-2 text-xs font-medium text-muted-foreground">
            <span className="flex size-6 items-center justify-center rounded-md bg-primary/10 text-primary">
              <Building2 className="size-3.5" />
            </span>
            成約事例
          </p>
          <h1 className="text-xl">マンションの成約事例</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            中古マンションの取引を最寄り駅ごとに地図に置きます。条件で絞り込んで、坪単価の相場を仕入れ値の参考にできます。
          </p>
        </div>

        <FilterPanel
          prefecture={prefecture}
          filters={filters}
          onPrefecture={(pref) => replaceSearchParams({ pref })}
          onChange={setFilters}
        />

        {status === "loading" ? (
          <p className="flex items-center text-sm text-muted-foreground" role="status">
            <Loader2 className="mr-2 size-4 animate-spin text-primary" aria-hidden />
            {prefectureName(prefecture)}の取引を読み込んでいます
          </p>
        ) : status === "failed" ? (
          <p className="text-sm text-destructive" role="alert">
            取引を読み込めませんでした。再読み込みしてください。
          </p>
        ) : !file ? (
          <p className="text-sm text-muted-foreground">
            {prefectureName(prefecture)}のマンションの取引はまだありません。
          </p>
        ) : (
          <>
            <SummaryCard
              key={selected ?? "all"}
              title={station ? stationLabel(station) : `${prefectureName(prefecture)}全体`}
              subtitle={
                station
                  ? [station.cityName, formatLines(station.lines, 3)].filter(Boolean).join("・")
                  : `${formatCount(byStation.size, "駅")}の取引`
              }
              summary={summary}
              onBack={station ? () => setSelected(null) : undefined}
            />
            {station ? (
              <TradeList key={selected} file={file} trades={scopeTrades} />
            ) : (
              <StationList file={file} byStation={byStation} onSelect={setSelected} />
            )}
          </>
        )}

        <Notes />
      </aside>

      <div className="relative order-1 h-[55svh] lg:order-2 lg:h-auto lg:flex-1">
        <div
          ref={container}
          className="h-full w-full"
          aria-label="成約事例の地図"
          role="application"
        />
        {!ready ? (
          <div className="absolute inset-0 flex items-center justify-center overflow-hidden bg-muted/40 text-sm text-muted-foreground">
            <div className="absolute inset-0 animate-pulse bg-[linear-gradient(to_right,var(--border)_1px,transparent_1px),linear-gradient(to_bottom,var(--border)_1px,transparent_1px)] bg-[size:48px_48px]" />
            <span className="relative flex items-center rounded-full border bg-background/90 px-4 py-2 shadow-sm backdrop-blur">
              <Loader2 className="mr-2 size-4 animate-spin text-primary" aria-hidden />
              地図を読み込んでいます
            </span>
          </div>
        ) : byStation.size > 0 ? (
          <div className="absolute top-3 left-3 w-56 rounded-xl border bg-background/90 p-3 text-xs shadow-sm backdrop-blur animate-in fade-in slide-in-from-top-2">
            <p className="mb-1.5 text-muted-foreground">駅ごとの坪単価（中央値）</p>
            <div className="flex">
              {SCALE_COLORS.map((color) => (
                <span
                  key={color}
                  className="h-2.5 flex-1 first:rounded-l last:rounded-r"
                  style={{ background: color }}
                />
              ))}
            </div>
            <div className="mt-1 flex justify-around text-muted-foreground tabular-nums">
              {scale.breaks.map((b, i) => (
                // 区切りが同じ値になることがあるため、位置をキーにする
                // biome-ignore lint/suspicious/noArrayIndexKey: 区切りは 4 つで並びが変わらない
                <span key={i}>{Math.round(perTsubo(b))}</span>
              ))}
            </div>
            <p className="mt-1.5 text-muted-foreground">万円/坪・円の大きさは件数</p>
          </div>
        ) : null}
        {ready && controller.current && <BasemapSwitcher map={controller.current} />}
      </div>
    </div>
  );
}

function FilterPanel({
  prefecture,
  filters,
  onPrefecture,
  onChange,
}: {
  prefecture: string;
  filters: CondoFilters;
  onPrefecture: (code: string) => void;
  onChange: (next: Partial<CondoFilters>) => void;
}) {
  const changed = JSON.stringify(filters) !== JSON.stringify(DEFAULT_FILTERS);
  const togglePlan = (plan: PlanGroup) =>
    onChange({
      plans: filters.plans.includes(plan)
        ? filters.plans.filter((p) => p !== plan)
        : [...filters.plans, plan],
    });
  return (
    <div className="flex flex-col gap-4 rounded-2xl border bg-card p-4 shadow-sm">
      <Field label="都道府県">
        <Select value={prefecture} onValueChange={onPrefecture}>
          <SelectTrigger className="h-9 w-full bg-background" aria-label="都道府県">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {condoPrefectures.map((code) => (
              <SelectItem key={code} value={code}>
                {prefectureName(code)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>

      <Field label="取引の時期">
        <Segmented
          label="取引の時期"
          value={String(filters.years)}
          options={PERIOD_YEARS.map((y) => ({ value: String(y), label: `直近${y}年` }))}
          onChange={(v) => onChange({ years: Number(v) as CondoFilters["years"] })}
        />
      </Field>

      <Field label="価格の種類">
        <Segmented
          label="価格の種類"
          value={filters.kind}
          options={(Object.keys(KINDS) as KindFilter[]).map((k) => ({ value: k, label: KINDS[k] }))}
          onChange={(v) => onChange({ kind: v as KindFilter })}
        />
      </Field>

      <Field label="間取り">
        <div className="flex flex-wrap gap-1.5">
          {(Object.keys(PLAN_GROUPS) as PlanGroup[]).map((plan) => {
            const on = filters.plans.includes(plan);
            return (
              <button
                key={plan}
                type="button"
                aria-pressed={on}
                onClick={() => togglePlan(plan)}
                className={cn(
                  "rounded-full border px-2.5 py-1 text-xs transition-colors",
                  on
                    ? "border-primary bg-primary text-primary-foreground"
                    : "bg-background text-foreground hover:border-primary/50",
                )}
              >
                {PLAN_GROUPS[plan]}
              </button>
            );
          })}
        </div>
      </Field>

      <Field label="専有面積">
        <RangeSelects
          label="専有面積"
          min={filters.areaMin}
          max={filters.areaMax}
          steps={AREA_STEPS}
          format={(v) => `${v}㎡`}
          onChange={(areaMin, areaMax) => onChange({ areaMin, areaMax })}
        />
      </Field>

      <Field label="築年数（取引した時点）">
        <RangeSelects
          label="築年数"
          min={filters.ageMin}
          max={filters.ageMax}
          steps={AGE_STEPS}
          format={(v) => `築${v}年`}
          onChange={(ageMin, ageMax) => onChange({ ageMin, ageMax })}
        />
      </Field>

      <label className="flex items-center justify-between gap-3 text-sm" htmlFor="condo-special">
        <span>
          事情のある取引も含める
          <span className="block text-xs text-muted-foreground">
            関係者間の取引・競売など。相場から外れやすいため既定は除きます
          </span>
        </span>
        <Switch
          id="condo-special"
          checked={filters.includeSpecial}
          onCheckedChange={(includeSpecial) => onChange({ includeSpecial })}
        />
      </label>

      {changed && (
        <Button
          variant="ghost"
          size="sm"
          className="self-start"
          onClick={() => onChange(DEFAULT_FILTERS)}
        >
          <RotateCcw />
          条件をクリア
        </Button>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      {children}
    </div>
  );
}

function Segmented({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="flex rounded-lg border bg-muted/50 p-0.5">
      {options.map((option) => (
        // biome-ignore lint/a11y/useSemanticElements: ボタンの見た目で切り替える（radio の input にすると並びを作り直す必要がある）
        <button
          key={option.value}
          type="button"
          role="radio"
          aria-checked={option.value === value}
          onClick={() => onChange(option.value)}
          className={cn(
            "flex-1 rounded-md px-2 py-1 text-xs transition-colors",
            option.value === value
              ? "bg-background font-medium text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

// 下限と上限の 2 つの選択。下限より小さい上限（とその逆）は選べないようにする
function RangeSelects({
  label,
  min,
  max,
  steps,
  format,
  onChange,
}: {
  label: string;
  min: number | null;
  max: number | null;
  steps: number[];
  format: (value: number) => string;
  onChange: (min: number | null, max: number | null) => void;
}) {
  const parse = (v: string) => (v === ANY ? null : Number(v));
  return (
    <div className="flex items-center gap-2">
      <Select
        value={min === null ? ANY : String(min)}
        onValueChange={(v) => onChange(parse(v), max)}
      >
        <SelectTrigger className="h-8 flex-1 bg-background" aria-label={`${label}の下限`}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ANY}>下限なし</SelectItem>
          {steps
            .filter((s) => max === null || s <= max)
            .map((s) => (
              <SelectItem key={s} value={String(s)}>
                {format(s)}以上
              </SelectItem>
            ))}
        </SelectContent>
      </Select>
      <span className="text-xs text-muted-foreground">〜</span>
      <Select
        value={max === null ? ANY : String(max)}
        onValueChange={(v) => onChange(min, parse(v))}
      >
        <SelectTrigger className="h-8 flex-1 bg-background" aria-label={`${label}の上限`}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ANY}>上限なし</SelectItem>
          {steps
            .filter((s) => min === null || s >= min)
            .map((s) => (
              <SelectItem key={s} value={String(s)}>
                {format(s)}以下
              </SelectItem>
            ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function SummaryCard({
  title,
  subtitle,
  summary,
  onBack,
}: {
  title: string;
  subtitle: string;
  summary: Summary | null;
  onBack?: () => void;
}) {
  const card = useRef<HTMLDivElement>(null);
  // 駅を選んだら（駅ごとに作り直される）概要が見える位置まで送る
  useEffect(() => {
    if (onBack) card.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [onBack]);
  return (
    <div
      ref={card}
      className="flex scroll-mt-4 flex-col gap-3 rounded-2xl border bg-card p-4 text-sm shadow-sm animate-in fade-in slide-in-from-bottom-2 duration-300"
    >
      {onBack && (
        <Button variant="ghost" size="xs" className="-ml-1 self-start" onClick={onBack}>
          <ArrowLeft />
          都道府県全体に戻る
        </Button>
      )}
      <div>
        <p className="text-lg font-semibold">{title}</p>
        {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
      </div>
      {summary === null ? (
        <p className="text-muted-foreground">
          この条件に合う取引はありません。条件をゆるめてください。
        </p>
      ) : (
        <>
          <div>
            <p className="text-xs text-muted-foreground">坪単価の中央値</p>
            <p className="text-2xl font-semibold tabular-nums">
              {formatManYenPerTsubo(summary.median)}
            </p>
            <p className="text-muted-foreground tabular-nums">
              よくある範囲 {formatTsuboRange(summary.low, summary.high)}
            </p>
          </div>
          <dl className="grid grid-cols-2 gap-y-1 tabular-nums">
            <dt className="text-muted-foreground">件数</dt>
            <dd className="text-right">
              {formatCount(summary.count, "件")}
              <span className="ml-1 text-xs text-muted-foreground">
                （成約 {formatCount(summary.contractCount, "件")}）
              </span>
            </dd>
            <dt className="text-muted-foreground">価格の中央値</dt>
            <dd className="text-right">{formatManYen(Math.round(summary.medianPrice))}</dd>
            <dt className="text-muted-foreground">専有面積の中央値</dt>
            <dd className="text-right">{summary.medianArea.toFixed(1)}㎡</dd>
          </dl>
          {summary.count < 10 && (
            <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
              <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden />
              件数が少ないため、値が振れやすい参考値です。
            </p>
          )}
          <PriceGuide summary={summary} />
        </>
      )}
    </div>
  );
}

// 仕入れ値の目安。専有面積を入れると、坪単価の 25%・50%・75% 点から価格を出す
function PriceGuide({ summary }: { summary: Summary }) {
  const [area, setArea] = useState(String(Math.round(summary.medianArea)));
  const value = Number(area);
  const valid = Number.isFinite(value) && value > 0 && value < 1000;
  const rows = [
    { label: "安め（下位 25%）", perSqm: summary.low, strong: true },
    { label: "中央値", perSqm: summary.median, strong: false },
    { label: "高め（上位 25%）", perSqm: summary.high, strong: false },
  ];
  return (
    <div className="flex flex-col gap-2 rounded-xl bg-muted/50 p-3">
      <label className="flex items-center gap-2 text-xs font-medium" htmlFor="condo-guide-area">
        <Calculator className="size-3.5 text-primary" aria-hidden />
        専有面積
        <Input
          id="condo-guide-area"
          inputMode="decimal"
          value={area}
          onChange={(e) => setArea(e.target.value)}
          className="h-7 w-20 bg-background text-right tabular-nums"
        />
        ㎡ なら
      </label>
      {valid ? (
        <dl className="grid grid-cols-2 gap-y-0.5 tabular-nums">
          {rows.map((row) => (
            <div key={row.label} className="contents">
              <dt className={cn("text-muted-foreground", row.strong && "text-foreground")}>
                {row.label}
              </dt>
              <dd className={cn("text-right", row.strong && "font-semibold")}>
                {formatManYen(Math.round(priceFor(row.perSqm, value) / 10) * 10)}
              </dd>
            </div>
          ))}
        </dl>
      ) : (
        <p className="text-xs text-muted-foreground">面積を数字で入れてください。</p>
      )}
      <p className="text-xs text-muted-foreground">
        坪単価 × 面積の目安です。階数・向き・管理状態などの違いは含みません。
      </p>
    </div>
  );
}

function StationList({
  file,
  byStation,
  onSelect,
}: {
  file: CondoFile;
  byStation: Map<number, Summary>;
  onSelect: (station: number) => void;
}) {
  const [order, setOrder] = useState<StationOrder>("count");
  const [requested, setPage] = useState(1);
  const sorted = [...byStation].sort(([, a], [, b]) =>
    order === "count" ? b.count - a.count : a.median - b.median,
  );
  const page = clampPage(requested, sorted.length, SHOWN_STATIONS);
  const shown = pageSlice(sorted, page, SHOWN_STATIONS);
  if (sorted.length === 0) return null;
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-semibold">駅ごとの相場</p>
        <Segmented
          label="駅の並べ方"
          value={order}
          options={[
            { value: "count", label: "件数の多い順" },
            { value: "cheap", label: "坪単価の安い順" },
          ]}
          onChange={(v) => {
            setOrder(v as StationOrder);
            setPage(1);
          }}
        />
      </div>
      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <MousePointerClick className="size-3.5" aria-hidden />
        地図の円か一覧の駅を押すと、その駅の取引を一覧できます。
      </p>
      <ul className="flex flex-col divide-y rounded-2xl border bg-card">
        {shown.map(([index, summary]) => {
          const station = file.stations[index];
          if (!station) return null;
          return (
            <li key={index}>
              <button
                type="button"
                onClick={() => onSelect(index)}
                className="flex w-full items-center gap-3 px-3 py-2.5 text-left text-sm transition-colors hover:bg-muted/60"
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{stationLabel(station)}</span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {[station.cityName, formatLines(station.lines, 2)].filter(Boolean).join("・")}
                  </span>
                </span>
                <span className="text-right tabular-nums">
                  <span className="block">{formatManYenPerTsubo(summary.median)}</span>
                  <span className="block text-xs text-muted-foreground">
                    {formatCount(summary.count, "件")}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      <Pager
        label="駅の一覧のページ"
        page={page}
        total={sorted.length}
        perPage={SHOWN_STATIONS}
        onChange={setPage}
      />
    </div>
  );
}

function stationName(file: CondoFile, index: number): string {
  const station = file.stations[index];
  return station ? stationLabel(station) : "駅名不明";
}

function TradeList({ file, trades }: { file: CondoFile; trades: Trade[] }) {
  const [requested, setPage] = useState(1);
  if (trades.length === 0) return null;
  const page = clampPage(requested, trades.length, SHOWN_TRADES);
  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm font-semibold">取引の一覧（新しい順）</p>
      <ul className="flex flex-col divide-y rounded-2xl border bg-card">
        {pageSlice(trades, page, SHOWN_TRADES).map((t) => (
          <li key={t.id} className="flex gap-3 px-3 py-2.5 text-sm">
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs text-muted-foreground">
                {[
                  formatQuarter(t.period),
                  stationName(file, t.station),
                  t.district || "地区不明",
                ].join("・")}
              </p>
              <p className="truncate">
                {[
                  t.plan || "間取り不明",
                  `${t.area.toFixed(1)}㎡`,
                  t.age === null ? "築年不明" : t.age === 0 ? "新築" : `築${t.age}年`,
                  t.structure,
                ]
                  .filter(Boolean)
                  .join("・")}
              </p>
              <p className="mt-0.5 flex flex-wrap gap-1">
                <Tag strong={t.contract}>{t.contract ? "成約価格" : "取引価格"}</Tag>
                {t.renovated !== null && <Tag>{t.renovated ? "改装済み" : "未改装"}</Tag>}
                {t.remarks && <Tag>{t.remarks}</Tag>}
              </p>
            </div>
            <div className="text-right tabular-nums">
              <p className="font-semibold">{formatManYen(t.price)}</p>
              <p className="text-xs text-muted-foreground">{formatManYenPerTsubo(t.perSqm)}</p>
              <p className="text-xs text-muted-foreground">{formatManYenPerSqm(t.perSqm)}</p>
            </div>
          </li>
        ))}
      </ul>
      <Pager
        label="取引の一覧のページ"
        page={page}
        total={trades.length}
        perPage={SHOWN_TRADES}
        onChange={setPage}
      />
    </div>
  );
}

function Tag({ children, strong = false }: { children: React.ReactNode; strong?: boolean }) {
  return (
    <span
      className={cn(
        "rounded px-1.5 py-0.5 text-[0.7rem] leading-none",
        strong ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground",
      )}
    >
      {children}
    </span>
  );
}

function Notes() {
  return (
    <div className="flex flex-col gap-1.5 text-xs text-muted-foreground">
      <p className="font-medium text-foreground">このデータについて</p>
      <p>{formatDataPeriod(dataset.sources.condoTrade)}（国土交通省 不動産情報ライブラリ）</p>
      <ul className="list-disc space-y-1 pl-4">
        <li>
          成約価格はレインズ（不動産流通機構）の成約情報、取引価格は国土交通省のアンケートによるものです。同じ取引が両方に含まれることがあります。
        </li>
        <li>
          位置は物件の最寄り駅です。駅からの距離・マンション名・所在地番は公表されていないため、駅と地区（町名）までで示しています。
        </li>
        <li>
          新築の分譲価格は含まれません。築年数を「築5年以下」にすると、新築に近い時期の取引を見られます。
        </li>
        <li>坪単価は価格 ÷ 専有面積から出しています。個別の物件の査定ではありません。</li>
      </ul>
    </div>
  );
}
