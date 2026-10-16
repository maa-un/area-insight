import { type AreaDetail, type LandPriceStats, RELIABLE_TRADE_COUNT } from "@area-insight/shared";
import { Scale } from "lucide-react";
import { useId, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { formatPercent, formatQuarter, formatYenPerSqm, formatYenPerTsubo } from "@/lib/format";
import { medianOf, percentileOf, quartilesOf, unitPriceOf, verdictOf } from "@/lib/land-price";
import { cn } from "@/lib/utils";

// 土地（宅地(土地)）の取引単価。地区ごとの相場と、価格チェッカー。
// 戸建の取引には ㎡単価が付かないため、土地の判断は土地だけの取引で行う。

type LandPrices = AreaDetail["landPrices"];
type District = LandPrices["districts"][number];

const DEFAULT_ROWS = 15;

export function LandPriceSection({
  areaName,
  landPrices,
}: {
  areaName: string;
  landPrices: LandPrices;
}) {
  const period =
    landPrices.periodFrom && landPrices.periodTo
      ? `${formatQuarter(landPrices.periodFrom)}〜${formatQuarter(landPrices.periodTo)}`
      : "";

  if (!landPrices.total) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>土地の単価</CardTitle>
          <CardDescription>この期間に土地だけの取引が無いため、単価を出せません。</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <section className="grid gap-6 lg:grid-cols-5" aria-label="土地の単価">
      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Scale className="size-5 text-primary" aria-hidden />
            この土地は高い？安い？
          </CardTitle>
          <CardDescription>
            検討中の土地の面積と価格を入れると、{areaName}
            の地区の取引単価と比べて、どの位置にあるかを出します。
          </CardDescription>
        </CardHeader>
        <CardContent>
          <LandPriceChecker total={landPrices.total} districts={landPrices.districts} />
        </CardContent>
      </Card>

      <Card className="lg:col-span-3">
        <CardHeader>
          <CardTitle>地区ごとの土地の単価</CardTitle>
          <CardDescription>
            宅地（土地）の取引の ㎡単価。{period}の取引{" "}
            {landPrices.total.count.toLocaleString("ja-JP")} 件。幅は下位 25%〜上位 25%。
          </CardDescription>
        </CardHeader>
        <CardContent>
          <DistrictTable total={landPrices.total} districts={landPrices.districts} />
        </CardContent>
      </Card>
    </section>
  );
}

function DistrictTable({ total, districts }: { total: LandPriceStats; districts: District[] }) {
  const [showAll, setShowAll] = useState(false);
  const rows = showAll ? districts : districts.slice(0, DEFAULT_ROWS);
  // 棒の長さの基準。上位 25% の最大値（極端な値に引きずられないよう、市区町村全体の 95% 点までに抑える）
  const scaleMax = Math.max(total.quantiles[19] ?? 0, ...rows.map((d) => quartilesOf(d).p75));

  return (
    <div className="flex flex-col gap-3">
      <table className="w-full table-fixed text-sm">
        <thead className="text-left text-muted-foreground">
          <tr className="border-b">
            <th className="py-2 font-medium">地区</th>
            <th className="w-32 py-2 text-right font-medium">中央値</th>
            <th className="hidden w-[36%] py-2 pl-4 font-medium sm:table-cell">幅</th>
            <th className="w-16 py-2 text-right font-medium">件数</th>
          </tr>
        </thead>
        <tbody className="tabular-nums">
          <Row label={`市区町村全体`} stats={total} scaleMax={scaleMax} emphasis />
          {rows.map((d) => (
            <Row
              key={d.district}
              label={d.district || "（地区なし）"}
              stats={d}
              scaleMax={scaleMax}
            />
          ))}
        </tbody>
      </table>
      {districts.length > DEFAULT_ROWS && (
        <Button
          variant="ghost"
          size="sm"
          className="self-start"
          onClick={() => setShowAll(!showAll)}
        >
          {showAll ? "件数の多い地区だけ表示" : `すべての地区を表示（${districts.length}）`}
        </Button>
      )}
    </div>
  );
}

function Row({
  label,
  stats,
  scaleMax,
  emphasis = false,
}: {
  label: string;
  stats: LandPriceStats;
  scaleMax: number;
  emphasis?: boolean;
}) {
  const median = medianOf(stats);
  const { p25, p75 } = quartilesOf(stats);
  const pct = (value: number) => `${Math.min(100, (value / scaleMax) * 100)}%`;
  const reference = stats.count < RELIABLE_TRADE_COUNT;
  return (
    <tr className={cn("border-b last:border-0", emphasis && "bg-muted/40 font-medium")}>
      <td className="py-2 pr-2">
        {label}
        {reference && (
          <Badge variant="outline" className="ml-1.5 font-normal">
            参考値
          </Badge>
        )}
      </td>
      <td className="py-2 text-right whitespace-nowrap">
        <div>{formatYenPerSqm(median)}</div>
        <div className="text-xs text-muted-foreground">{formatYenPerTsubo(median)}</div>
      </td>
      <td className="hidden py-2 pl-4 sm:table-cell">
        <div
          className="relative h-2.5 w-full rounded-full bg-muted"
          title={`${formatYenPerSqm(p25)} 〜 ${formatYenPerSqm(p75)}`}
        >
          <div
            className="absolute inset-y-0 rounded-full bg-primary/30"
            style={{ left: pct(p25), width: `calc(${pct(p75)} - ${pct(p25)})` }}
          />
          <div
            className="absolute inset-y-0 w-0.5 bg-primary"
            style={{ left: pct(median) }}
            aria-hidden
          />
        </div>
      </td>
      <td className="py-2 text-right">{stats.count.toLocaleString("ja-JP")}件</td>
    </tr>
  );
}

function LandPriceChecker({ total, districts }: { total: LandPriceStats; districts: District[] }) {
  const [districtName, setDistrictName] = useState("");
  const [areaText, setAreaText] = useState("");
  const [priceText, setPriceText] = useState("");
  const ids = { district: useId(), area: useId(), price: useId() };

  const selected = districts.find((d) => d.district === districtName);
  // 地区の件数が少ないときは、市区町村全体の分布で判定し、その旨を出す
  const useTotal = !selected || selected.count < RELIABLE_TRADE_COUNT;
  const stats = useTotal ? total : selected;
  const unitPrice = unitPriceOf(Number(priceText), Number(areaText));

  return (
    <form className="flex flex-col gap-4" onSubmit={(event) => event.preventDefault()}>
      <div className="grid gap-3 sm:grid-cols-3">
        <label htmlFor={ids.district} className="flex flex-col gap-1 text-xs text-muted-foreground">
          地区
          <select
            id={ids.district}
            className="h-9 rounded-md border border-input bg-background px-3 text-sm text-foreground shadow-xs"
            value={districtName}
            onChange={(e) => setDistrictName(e.target.value)}
          >
            <option value="">市区町村全体</option>
            {districts.map((d) => (
              <option key={d.district} value={d.district}>
                {d.district || "（地区なし）"}（{d.count}件）
              </option>
            ))}
          </select>
        </label>
        <label htmlFor={ids.area} className="flex flex-col gap-1 text-xs text-muted-foreground">
          土地の面積（㎡）
          <Input
            id={ids.area}
            inputMode="decimal"
            placeholder="例: 200"
            value={areaText}
            onChange={(e) => setAreaText(e.target.value)}
          />
        </label>
        <label htmlFor={ids.price} className="flex flex-col gap-1 text-xs text-muted-foreground">
          価格（万円）
          <Input
            id={ids.price}
            inputMode="decimal"
            placeholder="例: 1200"
            value={priceText}
            onChange={(e) => setPriceText(e.target.value)}
          />
        </label>
      </div>

      {unitPrice === null ? (
        <p className="text-sm text-muted-foreground">面積と価格を入れると判定が出ます。</p>
      ) : (
        <Result unitPrice={unitPrice} stats={stats} note={useTotal && selected ? selected : null} />
      )}
    </form>
  );
}

function Result({
  unitPrice,
  stats,
  note,
}: {
  unitPrice: number;
  stats: LandPriceStats;
  note: District | null;
}) {
  const percentile = percentileOf(stats, unitPrice);
  const median = medianOf(stats);
  const vsMedian = median > 0 ? ((unitPrice - median) / median) * 100 : null;
  const verdict = verdictOf(percentile);
  const tone = {
    low: "border-emerald-200 bg-emerald-50 text-emerald-900",
    mid: "border-border bg-muted/40 text-foreground",
    high: "border-rose-200 bg-rose-50 text-rose-900",
  }[verdict.tone];

  return (
    <div className={cn("flex flex-col gap-2 rounded-lg border p-4 text-sm", tone)} role="status">
      <p className="text-2xl font-bold tracking-tight">{verdict.label}</p>
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 tabular-nums">
        <dt className="opacity-70">この土地の単価</dt>
        <dd>
          {formatYenPerSqm(unitPrice)}（{formatYenPerTsubo(unitPrice)}）
        </dd>
        <dt className="opacity-70">地区の中央値</dt>
        <dd>
          {formatYenPerSqm(median)}
          {vsMedian !== null && <>（中央値比 {formatPercent(vsMedian, { signed: true })}）</>}
        </dd>
        <dt className="opacity-70">位置</dt>
        <dd>
          {stats.count} 件の取引の中で、安い方から {Math.round(percentile)}% の位置
        </dd>
      </dl>
      {note && (
        <p className="text-xs opacity-80">
          {note.district || "この地区"}は取引が {note.count}{" "}
          件と少ないため、市区町村全体の分布で判定しています。
        </p>
      )}
    </div>
  );
}
