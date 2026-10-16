import { prefectureName } from "@area-insight/shared";
import { ArrowRight, Loader2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  dataset,
  findArea,
  isMetricKey,
  landPrices,
  METRICS,
  type MetricKey,
  stations,
} from "@/data";
import {
  formatCount,
  formatManYen,
  formatMetric,
  formatPercent,
  formatYenPerSqm,
  formatYenPerTsubo,
} from "@/lib/format";
import type { LayerId, MapController, Selection } from "@/lib/map-engine";
import { NO_DATA_COLOR, quantileScale, SCALE_COLORS } from "@/lib/map-scale";
import { replaceSearchParams, useSearchParams } from "@/lib/search-params";
import { cn } from "@/lib/utils";
import { areaPath } from "@/routes";

const AREA_METRICS = Object.keys(METRICS).filter((k) => k !== "population") as MetricKey[];

const LAYERS: { id: LayerId; label: string; swatch: string }[] = [
  { id: "areas", label: "市区町村の塗り分け", swatch: SCALE_COLORS[3] },
  { id: "land", label: "地価公示・地価調査の地点", swatch: SCALE_COLORS[1] },
  { id: "stations", label: "駅ごとの取引相場", swatch: "#f97316" },
];

const landScale = quantileScale(landPrices.map((p) => p.price));

export function MapPage() {
  const params = useSearchParams();
  const metricParam = params.get("metric");
  const metric: MetricKey = isMetricKey(metricParam) ? metricParam : "tradePrice";

  const [visible, setVisible] = useState<Record<LayerId, boolean>>({
    areas: true,
    land: true,
    stations: true,
  });
  const [selection, setSelection] = useState<Selection | null>(null);
  const [ready, setReady] = useState(false);
  const [areasStatus, setAreasStatus] = useState<"loading" | "loaded" | "failed">("loading");
  const container = useRef<HTMLDivElement>(null);
  const controller = useRef<MapController | null>(null);

  const scale = useMemo(() => quantileScale(dataset.areas.map((a) => a[metric])), [metric]);

  // 地図の生成は 1 回だけ。?area= があればその市区町村に寄せて開く。
  // ハイドレーション直後はクエリがまだ空なので、URL から直接読む。
  useEffect(() => {
    const node = container.current;
    if (!node) return;
    const focus = findArea(new URLSearchParams(window.location.search).get("area") ?? "");
    let cancelled = false;
    void import("@/lib/map-engine").then(async ({ createMap }) => {
      const map = await createMap(node, {
        initial: focus?.center ? { center: focus.center, zoom: 10 } : undefined,
        onSelect: setSelection,
      });
      if (cancelled) {
        map.destroy();
        return;
      }
      controller.current = map;
      map.areasLoaded.then(
        () => !cancelled && setAreasStatus("loaded"),
        () => !cancelled && setAreasStatus("failed"),
      );
      map.setPoints(
        "land",
        landPrices.map((p) => ({
          coordinates: p.coordinates,
          properties: { ...p, coordinates: null, color: landScale.colorOf(p.price) },
        })),
      );
      map.setPoints(
        "stations",
        stations.map((s) => ({
          coordinates: s.coordinates,
          properties: { ...s, coordinates: null },
        })),
      );
      if (focus) setSelection({ layer: "areas", properties: { code: focus.code } });
      setReady(true);
    });
    return () => {
      cancelled = true;
      controller.current?.destroy();
      controller.current = null;
    };
  }, []);

  useEffect(() => {
    if (!ready) return;
    controller.current?.setAreaColors(
      new Map(dataset.areas.map((a) => [a.code, scale.colorOf(a[metric])])),
    );
  }, [ready, metric, scale]);

  // 押した市区町村の境界を強調する
  useEffect(() => {
    if (!ready) return;
    controller.current?.selectArea(
      selection?.layer === "areas" ? String(selection.properties.code) : null,
    );
  }, [ready, selection]);

  useEffect(() => {
    if (!ready) return;
    for (const layer of LAYERS) controller.current?.setVisible(layer.id, visible[layer.id]);
  }, [ready, visible]);

  return (
    <div className="flex flex-col lg:h-[calc(100svh-3.5rem-2.5rem)] lg:flex-row">
      <aside className="order-2 flex flex-col gap-6 border-t p-4 lg:order-1 lg:w-80 lg:overflow-y-auto lg:border-t-0 lg:border-r">
        <div>
          <h1 className="text-xl font-bold tracking-tight">地図で探す</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            拡大すると、地価の地点と駅ごとの取引相場が表示されます。
          </p>
        </div>

        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          色分けする指標
          <select
            className="h-9 rounded-md border border-input bg-background px-3 text-sm text-foreground shadow-xs"
            value={metric}
            onChange={(e) => replaceSearchParams({ metric: e.target.value })}
          >
            {AREA_METRICS.map((key) => (
              <option key={key} value={key}>
                {METRICS[key].label}
              </option>
            ))}
          </select>
        </label>

        <Legend
          title={METRICS[metric].label}
          labels={scale.breaks.map((b) => formatMetric(metric, b))}
        />

        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 text-xs text-muted-foreground">表示するもの</legend>
          {LAYERS.map((layer) => (
            <label key={layer.id} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="size-4 accent-primary"
                checked={visible[layer.id]}
                onChange={(e) => setVisible((v) => ({ ...v, [layer.id]: e.target.checked }))}
              />
              <span
                className={cn(
                  "inline-block size-3",
                  layer.id === "areas" ? "rounded-sm" : "rounded-full",
                )}
                style={{ background: layer.swatch }}
              />
              {layer.label}
            </label>
          ))}
        </fieldset>

        <SelectionCard selection={selection} metric={metric} />
      </aside>

      <div className="relative order-1 h-[60svh] lg:order-2 lg:h-auto lg:flex-1">
        <div ref={container} className="h-full w-full" aria-label="地図" role="application" />
        {!ready && (
          <div className="absolute inset-0 flex items-center justify-center bg-muted/40 text-sm text-muted-foreground">
            <Loader2 className="mr-2 size-4 animate-spin" aria-hidden />
            地図を読み込んでいます
          </div>
        )}
        {ready && areasStatus !== "loaded" && visible.areas && (
          <p
            className="absolute top-3 left-3 flex items-center rounded-md bg-background/90 px-3 py-1.5 text-xs text-muted-foreground shadow"
            role="status"
          >
            {areasStatus === "loading" ? (
              <>
                <Loader2 className="mr-1.5 size-3.5 animate-spin" aria-hidden />
                市区町村の境界を読み込んでいます
              </>
            ) : (
              "市区町村の境界を読み込めませんでした。再読み込みしてください"
            )}
          </p>
        )}
      </div>
    </div>
  );
}

function Legend({ title, labels }: { title: string; labels: string[] }) {
  return (
    <div className="flex flex-col gap-1.5 text-xs">
      <span className="text-muted-foreground">{title}</span>
      <div className="flex">
        {SCALE_COLORS.map((color) => (
          <span
            key={color}
            className="h-2.5 flex-1 first:rounded-l last:rounded-r"
            style={{ background: color }}
          />
        ))}
      </div>
      <div className="flex justify-around text-muted-foreground tabular-nums">
        {labels.map((label) => (
          <span key={label}>{label}</span>
        ))}
      </div>
      <span className="flex items-center gap-1.5 text-muted-foreground">
        <span className="inline-block size-2.5 rounded-sm" style={{ background: NO_DATA_COLOR }} />
        データなし
      </span>
    </div>
  );
}

function SelectionCard({ selection, metric }: { selection: Selection | null; metric: MetricKey }) {
  if (!selection) {
    return (
      <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
        地図上の市区町村や地点を押すと、ここに値が表示されます。
      </p>
    );
  }
  const p = selection.properties;
  const box = "flex flex-col gap-2 rounded-lg border p-4 text-sm";

  if (selection.layer === "areas") {
    const area = findArea(String(p.code));
    if (!area) return null;
    return (
      <div className={box}>
        <p className="text-xs text-muted-foreground">{prefectureName(area.prefectureCode)}</p>
        <p className="text-lg font-semibold">{area.name}</p>
        <dl className="grid grid-cols-2 gap-y-1 tabular-nums">
          {AREA_METRICS.map((key) => (
            <div key={key} className="contents">
              <dt className={cn("text-muted-foreground", key === metric && "text-foreground")}>
                {METRICS[key].label}
              </dt>
              <dd className={cn("text-right", key === metric && "font-semibold")}>
                {formatMetric(key, area[key])}
              </dd>
            </div>
          ))}
        </dl>
        <Button asChild size="sm" className="mt-2">
          <a href={areaPath(area.code)}>
            市区町村ページを見る
            <ArrowRight />
          </a>
        </Button>
      </div>
    );
  }

  if (selection.layer === "land") {
    return (
      <div className={box}>
        <p className="text-xs text-muted-foreground">地価（{String(p.use)}）</p>
        <p className="font-semibold">{String(p.location)}</p>
        <UnitPrice perSqm={Number(p.price)} />
        <p className="text-muted-foreground tabular-nums">
          前年比{" "}
          {formatPercent(p.changeRate === null ? null : Number(p.changeRate), { signed: true })}
        </p>
      </div>
    );
  }

  return (
    <div className={box}>
      <p className="text-xs text-muted-foreground">駅ごとの取引相場（直近 4 四半期）</p>
      <p className="font-semibold">
        {p.cityName ? `${String(p.cityName)}の駅` : "この駅"}を最寄りとする中古戸建
      </p>
      <p className="text-lg tabular-nums">{formatManYen(Number(p.medianPrice))}</p>
      <p className="text-muted-foreground">
        取引総額の中央値・取引 {formatCount(Number(p.count), "件")}
      </p>
    </div>
  );
}

// ㎡単価と坪単価を並べて出す。不動産の広告や査定では坪単価で話すことが多いため。
function UnitPrice({ perSqm }: { perSqm: number }) {
  return (
    <div className="flex flex-col tabular-nums">
      <span className="text-lg">{formatYenPerSqm(perSqm)}</span>
      <span className="text-muted-foreground">坪単価 {formatYenPerTsubo(perSqm)}</span>
    </div>
  );
}
