import type { LngLat } from "@area-insight/shared";
import {
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

// MapLibre を扱う部分。地図のある画面でだけ動的に読み込み、他の画面の表示を重くしない。
// 背景は地理院タイル（淡色地図）。出典表示が利用条件なので attribution に必ず入れる。

export type LayerId = "areas" | "land" | "stations";

export type Feature = { coordinates: LngLat; properties: Record<string, string | number | null> };

export type Selection = { layer: LayerId; properties: Record<string, unknown> };

export type MapController = {
  setData: (layer: LayerId, features: Feature[]) => void;
  setVisible: (layer: LayerId, visible: boolean) => void;
  flyTo: (center: LngLat, zoom: number) => void;
  destroy: () => void;
};

setWorkerUrl(workerUrl);

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
      },
      layers: [{ id: "gsi", type: "raster", source: "gsi" }],
    },
  });
  map.addControl(new NavigationControl({ showCompass: false }), "top-right");

  return new Promise((resolve) => {
    map.on("load", () => {
      for (const id of ["areas", "land", "stations"] as const) {
        map.addSource(id, { type: "geojson", data: collection([]) });
      }
      // 広域では市区町村の色分け、拡大すると地価と駅のポイントが見えるようにする。
      map.addLayer({
        id: "areas",
        type: "circle",
        source: "areas",
        paint: {
          "circle-color": ["get", "color"],
          "circle-radius": ["interpolate", ["linear"], ["zoom"], 4, 6, 8, 14, 12, 26],
          "circle-opacity": ["interpolate", ["linear"], ["zoom"], 9, 0.85, 12, 0.35],
          "circle-stroke-color": "#ffffff",
          "circle-stroke-width": 1.5,
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
          "circle-stroke-color": "#0f172a",
          "circle-stroke-width": 1,
        },
      });
      map.addLayer({
        id: "stations",
        type: "circle",
        source: "stations",
        minzoom: 8,
        paint: {
          "circle-color": "#f97316",
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

      resolve({
        setData: (layer, features) => {
          (map.getSource(layer) as GeoJSONSource | undefined)?.setData(collection(features));
        },
        setVisible: (layer, visible) => {
          map.setLayoutProperty(layer, "visibility", visible ? "visible" : "none");
        },
        flyTo: (center, zoom) => map.flyTo({ center, zoom }),
        destroy: () => map.remove(),
      });
    });
  });
}
