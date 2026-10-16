import { type AreaMetrics, DISTORTION_THRESHOLD } from "@area-insight/shared";
import { TriangleAlert } from "lucide-react";
import { Chip } from "@/components/brand";
import { DataPeriodNote } from "@/components/data-period";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { METRICS, type MetricKey } from "@/data";
import { formatMetric } from "@/lib/format";

// 市場の歪み（仕様書「市場の歪み指標」）。需要の指標は高いのに価格の指標は低い、を都道府県内の順位の差で示す。
// 「割安」「買い」とは断定せず、相場より低いことと根拠だけを示す。

type GapKey = "rentGap" | "landGap" | "momentumGap";

const GAPS: { key: GapKey; demand: string; price: string }[] = [
  { key: "rentGap", demand: "人口の増え方", price: "1㎡あたりの家賃" },
  { key: "landGap", demand: "人口の増え方", price: "土地の取引単価" },
  { key: "momentumGap", demand: "住宅地の地価の前年比", price: "土地の取引単価の前年比" },
];

export function MarketDistortionSection({
  area,
  prefecture,
}: {
  area: AreaMetrics;
  prefecture: string;
}) {
  const ratio = area.landToOfficialRatio;
  return (
    <Card>
      <CardHeader>
        <CardTitle>市場の歪み</CardTitle>
        <CardDescription>
          需要を表す指標と価格を表す指標の、{prefecture}
          内での順位の差（-100〜+100pt）。プラスが大きいほど、需要の割に価格が低い。+
          {DISTORTION_THRESHOLD}pt 以上を「歪みあり」としています。投資判断の助言ではありません。
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {area.weakDemand && (
          <div className="flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-900">
            <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
            <p>
              利回りは{prefecture}
              内で高い方ですが、人口が減り空き家も多い市区町村です。価格の低さは需要の弱さの表れとみなし、歪みのランキングには載せていません。
            </p>
          </div>
        )}
        <ul className="grid gap-3 sm:grid-cols-2">
          {GAPS.map(({ key, demand, price }) => (
            <GapItem
              key={key}
              metric={key}
              value={area[key]}
              description={`${demand}の順位 − ${price}の順位`}
            />
          ))}
          <li className="flex flex-col gap-1.5 rounded-lg border p-3">
            <p className="text-sm font-medium">{METRICS.landToOfficialRatio.label}</p>
            <p className="flex items-center gap-2 text-2xl font-bold tabular-nums">
              {formatMetric("landToOfficialRatio", ratio)}
              {ratio !== null && ratio < 1 && <Chip tone="good">公示地価を下回る</Chip>}
            </p>
            <p className="text-xs text-muted-foreground">
              土地の取引単価の中央値 ÷
              住宅地の地価の中央値。公示地価は標準的な更地の価格のため、古家付き・不整形地の多い市区町村では低めに出ます。
            </p>
            <DataPeriodNote sources={METRICS.landToOfficialRatio.sources} />
          </li>
        </ul>
      </CardContent>
    </Card>
  );
}

function GapItem({
  metric,
  value,
  description,
}: {
  metric: MetricKey;
  value: number | null;
  description: string;
}) {
  return (
    <li className="flex flex-col gap-1.5 rounded-lg border p-3">
      <p className="text-sm font-medium">{METRICS[metric].label}</p>
      <p className="flex items-center gap-2 text-2xl font-bold tabular-nums">
        {formatMetric(metric, value)}
        {value !== null && value >= DISTORTION_THRESHOLD && <Chip tone="good">歪みあり</Chip>}
      </p>
      <p className="text-xs text-muted-foreground">
        {description}
        {value === null && "。元データが無いか、取引が少ないため出していません"}
      </p>
      <DataPeriodNote sources={METRICS[metric].sources} />
    </li>
  );
}
