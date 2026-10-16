import {
  type AreaDetail,
  type LandPriceStats,
  METERS_PER_WALK_MINUTE,
  type OfficialLandPrices,
  RELIABLE_TRADE_COUNT,
  type StationDistanceBand,
} from "@area-insight/shared";
import { Landmark, Scale, TrainFront } from "lucide-react";
import { useId, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  formatPercent,
  formatQuarter,
  formatRatio,
  formatYenPerSqm,
  formatYenPerTsubo,
} from "@/lib/format";
import {
  medianOf,
  officialVerdictOf,
  percentileOf,
  quartilesOf,
  ratioToOfficial,
  unitPriceOf,
  verdictOf,
} from "@/lib/land-price";
import { cn } from "@/lib/utils";

// 土地（宅地(土地)）の取引単価。地区ごとの相場と、価格チェッカー。
// 戸建の取引には ㎡単価が付かないため、土地の判断は土地だけの取引で行う。

type LandPrices = AreaDetail["landPrices"];
type District = LandPrices["districts"][number];

const DEFAULT_ROWS = 15;

// 判定の色。土地の価格チェッカーと公示地価との比較で同じ色を使う。
const TONE = {
  low: "border-good/50 text-good",
  mid: "border-border text-muted-foreground",
  high: "border-bad/50 text-bad",
} as const;

const BAND_LABELS: Record<StationDistanceBand, string> = {
  within10: "駅から徒歩 10 分以内",
  within20: "徒歩 10〜20 分",
  over20: "徒歩 20 分超",
};
const BAND_NOTES: Record<StationDistanceBand, string> = {
  within10: `〜${(10 * METERS_PER_WALK_MINUTE).toLocaleString("ja-JP")}m`,
  within20: `〜${(20 * METERS_PER_WALK_MINUTE).toLocaleString("ja-JP")}m`,
  over20: `${(20 * METERS_PER_WALK_MINUTE).toLocaleString("ja-JP")}m 超`,
};

export function LandPriceSection({
  areaName,
  landPrices,
  official,
}: {
  areaName: string;
  landPrices: LandPrices;
  official: OfficialLandPrices;
}) {
  const period =
    landPrices.periodFrom && landPrices.periodTo
      ? `${formatQuarter(landPrices.periodFrom)}〜${formatQuarter(landPrices.periodTo)}`
      : "";

  const officialPrice = official.residential?.price ?? null;

  if (!landPrices.total) {
    return (
      <section className="grid gap-6 lg:grid-cols-5" aria-label="土地の単価">
        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle>土地の単価</CardTitle>
            <CardDescription>
              この期間に土地だけの取引が無いため、単価を出せません。
            </CardDescription>
          </CardHeader>
        </Card>
        <StationDistanceCard areaName={areaName} official={official} className="lg:col-span-2" />
      </section>
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
          <LandPriceChecker
            total={landPrices.total}
            districts={landPrices.districts}
            officialPrice={officialPrice}
          />
        </CardContent>
      </Card>

      <Card className="lg:col-span-3">
        <CardHeader>
          <CardTitle>地区ごとの土地の単価</CardTitle>
          <CardDescription>
            宅地（土地）の取引の ㎡単価。{period}の取引{" "}
            {landPrices.total.count.toLocaleString("ja-JP")} 件。幅は下位 25%〜上位 25%。
            {officialPrice !== null &&
              "公示地価比は、住宅地の公示地価・地価調査の中央値に対する倍率。"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <DistrictTable
            total={landPrices.total}
            districts={landPrices.districts}
            officialPrice={officialPrice}
          />
        </CardContent>
      </Card>

      <OfficialComparisonCard
        areaName={areaName}
        total={landPrices.total}
        official={official}
        className="lg:col-span-3"
      />
      <StationDistanceCard areaName={areaName} official={official} className="lg:col-span-2" />
    </section>
  );
}

// 実勢（土地の取引単価の中央値）と公示地価（住宅地の地点の中央値）の比較。
function OfficialComparisonCard({
  areaName,
  total,
  official,
  className,
}: {
  areaName: string;
  total: LandPriceStats;
  official: OfficialLandPrices;
  className?: string;
}) {
  const median = medianOf(total);
  const ratio = ratioToOfficial(median, official.residential?.price ?? null);
  const verdict = ratio === null ? null : officialVerdictOf(ratio);
  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Landmark className="size-5 text-primary" aria-hidden />
          実勢単価と公示地価の比較
        </CardTitle>
        <CardDescription>
          {areaName}
          の土地の取引単価（中央値）を、同じ市区町村の住宅地の公示地価・地価調査（地点の中央値）と比べます。
          1 倍未満なら、公示地価より安く取引されています。
        </CardDescription>
      </CardHeader>
      <CardContent>
        {official.residential === null || ratio === null || verdict === null ? (
          <p className="text-sm text-muted-foreground">
            この市区町村には住宅地の地価の地点が無いため、比べられません。
          </p>
        ) : (
          <div
            className={cn("flex flex-col gap-3 rounded-lg border p-4 text-sm", TONE[verdict.tone])}
          >
            <p className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <span className="text-3xl font-bold tracking-tight tabular-nums">
                {formatRatio(ratio)}
              </span>
              <span className="font-medium">{verdict.label}</span>
            </p>
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 tabular-nums">
              <dt className="opacity-70">取引単価の中央値</dt>
              <dd>
                {formatYenPerSqm(median)}（{formatYenPerTsubo(median)}）・{total.count} 件
              </dd>
              <dt className="opacity-70">住宅地の公示地価</dt>
              <dd>
                {formatYenPerSqm(official.residential.price)}（
                {formatYenPerTsubo(official.residential.price)}）・{official.residential.count} 地点
              </dd>
            </dl>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// 駅からの距離別の住宅地の公示地価。
function StationDistanceCard({
  areaName,
  official,
  className,
}: {
  areaName: string;
  official: OfficialLandPrices;
  className?: string;
}) {
  const bands = official.byStationDistance;
  const scaleMax = Math.max(0, ...bands.map((b) => b.price));
  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrainFront className="size-5 text-primary" aria-hidden />
          駅からの距離別の公示地価
        </CardTitle>
        <CardDescription>
          {areaName}の住宅地の公示地価・地価調査の地点を、最寄り駅までの道路距離で分けた中央値。徒歩
          1 分 = {METERS_PER_WALK_MINUTE}m。
        </CardDescription>
      </CardHeader>
      <CardContent>
        {bands.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            この市区町村には駅までの距離の分かる住宅地の地点がありません。
          </p>
        ) : (
          <table className="w-full table-fixed text-sm">
            <thead className="text-left text-muted-foreground">
              <tr className="border-b">
                <th className="py-2 font-medium">駅からの距離</th>
                <th className="w-32 py-2 text-right font-medium">中央値</th>
                <th className="w-16 py-2 text-right font-medium">地点</th>
              </tr>
            </thead>
            <tbody className="tabular-nums">
              {bands.map((b) => (
                <tr key={b.band} className="border-b last:border-0">
                  <td className="py-2 pr-2">
                    <div>{BAND_LABELS[b.band]}</div>
                    <div className="text-xs text-muted-foreground">{BAND_NOTES[b.band]}</div>
                    <div
                      className="mt-1.5 h-1.5 rounded-full bg-primary/30"
                      style={{ width: `${scaleMax > 0 ? (b.price / scaleMax) * 100 : 0}%` }}
                      aria-hidden
                    />
                  </td>
                  <td className="py-2 text-right whitespace-nowrap align-top">
                    <div>{formatYenPerSqm(b.price)}</div>
                    <div className="text-xs text-muted-foreground">
                      {formatYenPerTsubo(b.price)}
                    </div>
                  </td>
                  <td className="py-2 text-right align-top">{b.count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </CardContent>
    </Card>
  );
}

function DistrictTable({
  total,
  districts,
  officialPrice,
}: {
  total: LandPriceStats;
  districts: District[];
  officialPrice: number | null;
}) {
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
            <th className="hidden w-[30%] py-2 pl-4 font-medium sm:table-cell">幅</th>
            {officialPrice !== null && (
              <th className="w-20 py-2 text-right font-medium">公示地価比</th>
            )}
            <th className="w-16 py-2 text-right font-medium">件数</th>
          </tr>
        </thead>
        <tbody className="tabular-nums">
          <Row
            label={`市区町村全体`}
            stats={total}
            scaleMax={scaleMax}
            officialPrice={officialPrice}
            emphasis
          />
          {rows.map((d) => (
            <Row
              key={d.district}
              label={d.district || "（地区なし）"}
              stats={d}
              scaleMax={scaleMax}
              officialPrice={officialPrice}
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
  officialPrice,
  emphasis = false,
}: {
  label: string;
  stats: LandPriceStats;
  scaleMax: number;
  officialPrice: number | null;
  emphasis?: boolean;
}) {
  const median = medianOf(stats);
  const ratio = ratioToOfficial(median, officialPrice);
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
      {officialPrice !== null && (
        <td
          className={cn(
            "py-2 text-right",
            ratio !== null && ratio < 0.95 && "text-good",
            ratio !== null && ratio > 1.05 && "text-bad",
          )}
        >
          {formatRatio(ratio)}
        </td>
      )}
      <td className="py-2 text-right">{stats.count.toLocaleString("ja-JP")}件</td>
    </tr>
  );
}

function LandPriceChecker({
  total,
  districts,
  officialPrice,
}: {
  total: LandPriceStats;
  districts: District[];
  officialPrice: number | null;
}) {
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
        <Result
          unitPrice={unitPrice}
          stats={stats}
          note={useTotal && selected ? selected : null}
          officialPrice={officialPrice}
        />
      )}
    </form>
  );
}

function Result({
  unitPrice,
  stats,
  note,
  officialPrice,
}: {
  unitPrice: number;
  stats: LandPriceStats;
  note: District | null;
  officialPrice: number | null;
}) {
  const percentile = percentileOf(stats, unitPrice);
  const median = medianOf(stats);
  const vsMedian = median > 0 ? ((unitPrice - median) / median) * 100 : null;
  const verdict = verdictOf(percentile);
  const ratio = ratioToOfficial(unitPrice, officialPrice);

  return (
    <div
      className={cn("flex flex-col gap-2 rounded-lg border p-4 text-sm", TONE[verdict.tone])}
      role="status"
    >
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
        {ratio !== null && officialPrice !== null && (
          <>
            <dt className="opacity-70">公示地価比</dt>
            <dd>
              {formatRatio(ratio)}（住宅地の公示地価 {formatYenPerSqm(officialPrice)}）
            </dd>
          </>
        )}
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
