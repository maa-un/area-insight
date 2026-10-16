import { Boundaries, type LngLat, type MunicipalityCode } from "@area-insight/shared";
import {
  type ExpressionSpecification,
  type GeoJSONSource,
  type MapLayerMouseEvent,
  Map as MapLibreMap,
  NavigationControl,
  setWorkerUrl,
} from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { FeatureCollection } from "geojson";
// MapLibre 6 は描画用の Worker を別ファイルで読む。Vite に Worker として束ねさせ、その URL を渡す。
import workerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url";
// 市区町村の境界（3.0MB、gzip で 0.7MB）。ハッシュ付きのファイルとして出力し、地図のページでだけ取りに行く。
import boundariesUrl from "@/data/boundaries.json?url";
import { NO_DATA_COLOR, STATION_COLOR } from "@/lib/map-scale";

// MapLibre を扱う部分。地図のある画面でだけ動的に読み込み、他の画面の表示を重くしない。
// 背景は地理院タイル（淡色地図）。出典表示が利用条件なので attribution に必ず入れる。
// 市区町村は境界の面を指標で塗り分ける。色は地物の feature-state に持たせ、指標を切り替えても
// 3MB の境界を作り直さずに済むようにする。

export type LayerId = "areas" | "land" | "stations";
type PointLayerId = Exclude<LayerId, "areas">;

export type Feature = { coordinates: LngLat; properties: Record<string, string | number | null> };

export type Selection = { layer: LayerId; properties: Record<string, unknown> };

export type MapController = {
  // 境界の読み込みが終わると解決する。失敗すると reject する（地点の表示はそのまま使える）
  areasLoaded: Promise<void>;
  setPoints: (layer: PointLayerId, features: Feature[]) => void;
  // 市区町村コード → 塗る色。含まれない市区町村は「データなし」の色になる
  setAreaColors: (colors: ReadonlyMap<MunicipalityCode, string>) => void;
  // 押した市区町村の境界を強調する。null で解除
  selectArea: (code: MunicipalityCode | null) => void;
  setVisible: (layer: LayerId, visible: boolean) => void;
  flyTo: (center: LngLat, zoom: number) => void;
  destroy: () => void;
};

setWorkerUrl(workerUrl);

async function loadBoundaries(): Promise<FeatureCollection> {
  const response = await fetch(boundariesUrl);
  if (!response.ok)
    throw new Error(`境界ファイルを取得できませんでした（HTTP ${response.status}）`);
  // geometry の中身は検証していないが、形は build-boundaries.mjs の出力どおり
  return Boundaries.parse(await response.json()) as FeatureCollection;
}

const JAPAN: { center: LngLat; zoom: number } = { center: [137.5, 37.8], zoom: 4.2 };

function collection(features: Feature[]): FeatureCollection {
  return {
    type: "FeatureCollection",
    features: features.map((f) => ({
      type: "Feature",
      geometry: { type: "Point", coordinates: f.coordinates },
      properties: f.properties,
    })),
  };
}

export function createMap(
  container: HTMLElement,
  options: { initial?: { center: LngLat; zoom: number }; onSelect: (s: Selection | null) => void },
): Promise<MapController> {
  const initial = options.initial ?? JAPAN;
  const map = new MapLibreMap({
    container,
    center: initial.center,
    zoom: initial.zoom,
    minZoom: 3.5,
    maxZoom: 16,
    attributionControl: { compact: true },
    style: {
      version: 8,
      sources: {
        gsi: {
          type: "raster",
          tiles: ["https://cyberjapandata.gsi.go.jp/xyz/pale/{z}/{x}/{y}.png"],
          tileSize: 256,
          maxzoom: 18,
          attribution:
            '<a href="https://maps.gsi.go.jp/development/ichiran.html" target="_blank" rel="noopener">地理院タイル</a>',
        },
        areas: {
          type: "geojson",
          data: { type: "FeatureCollection", features: [] },
          // properties.code を地物の id にし、feature-state で色と選択を持たせる
          promoteId: "code",
          attribution:
            '<a href="https://nlftp.mlit.go.jp/ksj/gml/datalist/KsjTmplt-N03-2026.html" target="_blank" rel="noopener">国土数値情報（行政区域データ）</a>（国土交通省）をもとに合同会社Maa\'un Japan 作成',
        },
      },
      layers: [{ id: "gsi", type: "raster", source: "gsi" }],
    },
  });
  map.addControl(new NavigationControl({ showCompass: false }), "top-right");
  // 地図の準備と並行して境界を取りに行く
  const boundaries = loadBoundaries();
  // 失敗は areasLoaded で伝える。地図の準備が終わる前に失敗しても未処理の reject にしない
  boundaries.catch(() => undefined);

  return new Promise((resolve) => {
    map.on("load", () => {
      for (const id of ["land", "stations"] as const) {
        map.addSource(id, { type: "geojson", data: collection([]) });
      }
      // 広域では市区町村の塗り分け、拡大すると地価と駅のポイントが見えるようにする。
      // 拡大するほど面を薄くし、背景の地図の地名や道路を読めるようにする。
      map.addLayer({
        id: "areas",
        type: "fill",
        source: "areas",
        paint: {
          "fill-color": ["to-color", ["coalesce", ["feature-state", "color"], NO_DATA_COLOR]],
          "fill-opacity": ["interpolate", ["linear"], ["zoom"], 5, 0.8, 10, 0.6, 13, 0.3],
        },
      });
      // 境界線。押した市区町村は濃く太くする（ズームの補間は 1 つしか書けないため、各段で分ける）
      const isSelected: ExpressionSpecification = ["boolean", ["feature-state", "selected"], false];
      map.addLayer({
        id: "areas-outline",
        type: "line",
        source: "areas",
        layout: { "line-join": "round" },
        paint: {
          "line-color": ["case", isSelected, "#2a2622", "rgba(42, 38, 34, 0.3)"],
          "line-width": [
            "interpolate",
            ["linear"],
            ["zoom"],
            5,
            ["case", isSelected, 2, 0.3],
            9,
            ["case", isSelected, 2.5, 0.7],
            12,
            ["case", isSelected, 3.5, 1.2],
          ],
        },
      });
      map.addLayer({
        id: "land",
        type: "circle",
        source: "land",
        minzoom: 8,
        paint: {
          "circle-color": ["get", "color"],
          "circle-radius": ["interpolate", ["linear"], ["zoom"], 8, 3, 14, 8],
          "circle-stroke-color": "#ffffff",
          "circle-stroke-width": 1,
        },
      });
      map.addLayer({
        id: "stations",
        type: "circle",
        source: "stations",
        minzoom: 8,
        paint: {
          "circle-color": STATION_COLOR,
          "circle-radius": ["interpolate", ["linear"], ["zoom"], 8, 4, 14, 10],
          "circle-stroke-color": "#ffffff",
          "circle-stroke-width": 2,
        },
      });

      // 上に描いたもの（駅 → 地価 → 市区町村）を優先して選ぶ。
      const order: LayerId[] = ["stations", "land", "areas"];
      map.on("click", (event: MapLayerMouseEvent) => {
        const layers = order.filter(
          (id) => map.getLayer(id) && map.getLayoutProperty(id, "visibility") !== "none",
        );
        const hit = map.queryRenderedFeatures(event.point, { layers })[0];
        options.onSelect(
          hit ? { layer: hit.layer.id as LayerId, properties: hit.properties } : null,
        );
      });
      for (const id of order) {
        map.on("mouseenter", id, () => {
          map.getCanvas().style.cursor = "pointer";
        });
        map.on("mouseleave", id, () => {
          map.getCanvas().style.cursor = "";
        });
      }

      let colors: ReadonlyMap<MunicipalityCode, string> = new Map();
      let selected: MunicipalityCode | null = null;
      let loaded = false;
      // 境界の読み込み前に色や選択が来ても、読み込み後にまとめて反映する
      const applyColors = () => {
        if (!loaded) return;
        map.removeFeatureState({ source: "areas" });
        for (const [code, color] of colors)
          map.setFeatureState({ source: "areas", id: code }, { color });
        if (selected) map.setFeatureState({ source: "areas", id: selected }, { selected: true });
      };
      const areasLoaded = boundaries.then((data) => {
        (map.getSource("areas") as GeoJSONSource).setData(data);
        loaded = true;
        applyColors();
      });

      resolve({
        areasLoaded,
        setPoints: (layer, features) => {
          (map.getSource(layer) as GeoJSONSource | undefined)?.setData(collection(features));
        },
        setAreaColors: (next) => {
          colors = next;
          applyColors();
        },
        selectArea: (code) => {
          if (loaded && selected) {
            map.setFeatureState({ source: "areas", id: selected }, { selected: false });
          }
          selected = code;
          if (loaded && code)
            map.setFeatureState({ source: "areas", id: code }, { selected: true });
        },
        setVisible: (layer, visible) => {
          const value = visible ? "visible" : "none";
          map.setLayoutProperty(layer, "visibility", value);
          if (layer === "areas") map.setLayoutProperty("areas-outline", "visibility", value);
        },
        flyTo: (center, zoom) => map.flyTo({ center, zoom }),
        destroy: () => map.remove(),
      });
    });
  });
}
