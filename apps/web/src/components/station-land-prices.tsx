import {
  RELIABLE_TRADE_COUNT,
  STATION_DISTANCE_BANDS,
  type StationLandPrice,
} from "@area-insight/shared";
import { TrainFront } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { dataset } from "@/data";
import { formatDate, formatManYenPerTsubo, formatTsuboRange, NO_DATA } from "@/lib/format";
import { formatDataPeriod, formatLandPriceAsOf } from "@/lib/period";

// 駅ごとの土地の坪単価の目安（仕様書「駅ごとの妥当な土地の坪単価」）。
// その駅が最寄りの土地の取引を最新の公示地価の時点に補正し、25%〜75% を「妥当な範囲」として示す。
// 取引には駅からの距離が無いため、距離別には同じ駅が最寄りの住宅地の地価を並べる。

const BAND_HEADERS = {
  within10: "徒歩 10 分以内",
  within20: "10〜20 分",
  over20: "20 分超",
} as const;

// 最初に出す駅の数（取引の多い順）。残りは「すべて表示」で開く。
const SHOWN_STATIONS = 10;

export function StationLandPriceSection({
  areaName,
  stations,
}: {
  areaName: string;
  stations: StationLandPrice[];
}) {
  const adjustedTo = stations.find((s) => s.adjustedTo)?.adjustedTo ?? null;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrainFront className="size-5 text-primary" aria-hidden />
          最寄り駅ごとの土地の坪単価
        </CardTitle>
        <CardDescription>
          {areaName}
          で取引された土地を最寄り駅で分け、取引単価の下位 25%〜上位 25%
          を「妥当な範囲」としています。
          {adjustedTo
            ? `取引時期の違いは、住宅地の地価の前年比で ${formatDate(adjustedTo)} の時点に補正しています。`
            : ""}
          形・接道・面積の違いは補正していません。個別の土地の査定ではありません。
        </CardDescription>
        <p className="text-xs text-muted-foreground">
          {formatDataPeriod(dataset.sources.stationLandTrade)}・
          {formatLandPriceAsOf(dataset.sources)}
        </p>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        {stations.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            この市区町村では、駅ごとに分けられる土地の取引がありません。
          </p>
        ) : (
          <StationTable stations={stations} />
        )}
      </CardContent>
    </Card>
  );
}

function StationTable({ stations }: { stations: StationLandPrice[] }) {
  const [expanded, setExpanded] = useState(false);
  const shown = expanded ? stations : stations.slice(0, SHOWN_STATIONS);
  return (
    <div className="flex flex-col gap-3">
      <table className="w-full min-w-[640px] text-sm">
        <thead className="text-left text-muted-foreground">
          <tr className="border-b">
            <th className="py-2 font-medium">駅</th>
            <th className="py-2 text-right font-medium">妥当な範囲</th>
            <th className="py-2 text-right font-medium">中央値</th>
            <th className="py-2 text-right font-medium">取引</th>
            {STATION_DISTANCE_BANDS.map((band) => (
              <th key={band} className="py-2 text-right font-medium">
                公示地価 {BAND_HEADERS[band]}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="tabular-nums">
          {shown.map((s) => (
            <StationRow key={`${s.stationName}-${s.coordinates.join(",")}`} station={s} />
          ))}
        </tbody>
      </table>
      {stations.length > SHOWN_STATIONS && (
        <Button
          variant="outline"
          size="sm"
          className="self-start"
          onClick={() => setExpanded(!expanded)}
        >
          {expanded
            ? "取引の多い駅だけにする"
            : `ほか ${stations.length - SHOWN_STATIONS} 駅も表示`}
        </Button>
      )}
      <p className="text-xs text-muted-foreground">
        公示地価は、同じ駅が最寄りの住宅地の地点（公示地価・基準地価）の中央値。括弧内は地点数。
      </p>
    </div>
  );
}

function StationRow({ station }: { station: StationLandPrice }) {
  const reference = station.count < RELIABLE_TRADE_COUNT;
  const bands = new Map(station.officialByStationDistance.map((b) => [b.band, b]));
  return (
    <tr className="border-b last:border-0">
      <td className="py-2">
        <p className="font-medium">{station.stationName}駅</p>
        {station.lineNames.length > 0 && (
          <p className="text-xs text-muted-foreground">
            {station.lineNames.slice(0, 3).join("・")}
          </p>
        )}
      </td>
      <td className="py-2 text-right font-bold">
        {formatTsuboRange(station.low, station.high)}
        {reference && (
          <Badge variant="outline" className="ml-1.5">
            参考値
          </Badge>
        )}
      </td>
      <td className="py-2 text-right">{formatManYenPerTsubo(station.median)}</td>
      <td className="py-2 text-right">{station.count}件</td>
      {STATION_DISTANCE_BANDS.map((band) => {
        const value = bands.get(band);
        return (
          <td key={band} className="py-2 text-right text-muted-foreground">
            {value ? `${formatManYenPerTsubo(value.price)}（${value.count}）` : NO_DATA}
          </td>
        );
      })}
    </tr>
  );
}
