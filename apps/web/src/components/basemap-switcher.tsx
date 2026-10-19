import { useState } from "react";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { BASEMAPS, isBasemapId, storeBasemap } from "@/lib/basemaps";
import type { MapController } from "@/lib/map-engine";
import { cn } from "@/lib/utils";

// 地図の背景を切り替える。地図の右上、拡大・縮小のボタンの下に縦に並べる
// （左上は凡例や読み込み中の表示、下は出典が使う）
export function BasemapSwitcher({ map, className }: { map: MapController; className?: string }) {
  const [value, setValue] = useState(map.getBasemap);

  return (
    <ToggleGroup
      type="single"
      variant="outline"
      size="sm"
      spacing={0}
      orientation="vertical"
      value={value}
      aria-label="背景の地図"
      className={cn(
        "absolute top-[78px] right-2.5 bg-background/90 shadow-sm backdrop-blur animate-in fade-in",
        className,
      )}
      onValueChange={(next) => {
        // 選んでいるものをもう一度押すと空になるので、そのときは何もしない
        if (!isBasemapId(next)) return;
        setValue(next);
        map.setBasemap(next).then(
          () => storeBasemap(next),
          // 取れなかったときは元の背景のまま。表示も戻す
          () => setValue(map.getBasemap()),
        );
      }}
    >
      {BASEMAPS.map((basemap) => (
        <ToggleGroupItem
          key={basemap.id}
          value={basemap.id}
          title={basemap.description}
          aria-label={basemap.description}
          className="data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
        >
          {basemap.label}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}
