import { Boundaries, type LngLat, type MunicipalityCode } from "@area-insight/shared";
import {
  type ExpressionSpecification,
  type GeoJSONSource,
  type MapLayerMouseEvent,
  Map as MapLibreMap,
  NavigationControl,
  Popup,
  type StyleSpecification,
  setWorkerUrl,
} from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { FeatureCollection } from "geojson";
// MapLibre 6 は描画用の Worker を別ファイルで読む。Vite に Worker として束ねさせ、その URL を渡す。
import workerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url";
// 市区町村の境界（3.0MB、gzip で 0.7MB）。ハッシュ付きのファイルとして出力し、地図のページでだけ取りに行く。
import boundariesUrl from "@/data/boundaries.json?url";
import {
  BASE_PREFIX,
  BASEMAP_SOURCES,
  type BasemapId,
  type BasemapParts,
  DEFAULT_BASEMAP,
  rasterParts,
  vectorParts,
} from "@/lib/basemaps";
import { NO_DATA_COLOR, STATION_COLOR } from "@/lib/map-scale";

// MapLibre を扱う部分。地図のある画面でだけ動的に読み込み、他の画面の表示を重くしない。
// 背景は地理院タイルか OpenFreeMap（basemaps.ts）。出典表示が利用条件なので attribution に必ず入れる。
// 背景を切り替えるときは背景の部品だけを入れ替え、上に重ねた境界や地点は作り直さない。
// 市区町村は境界の面を指標で塗り分ける。色は地物の feature-state に持たせ、指標を切り替えても
// 3MB の境界を作り直さずに済むようにする。

export type LayerId = "areas" | "land" | "stations" | "condos";
type PointLayerId = Exclude<LayerId, "areas">;

export type Feature = { coordinates: LngLat; properties: Record<string, string | number | null> };

export type Selection = { layer: LayerId; properties: Record<string, unknown> };

// 吹き出しの中身。文字だけを受け取り、textContent で入れる（HTML として解釈しない）
export type PopupContent = { title: string; lines: string[] };

export type MapController = {
  // 境界の読み込みが終わると解決する。失敗すると reject する（地点の表示はそのまま使える）
  areasLoaded: Promise<void>;
  setPoints: (layer: PointLayerId, features: Feature[]) => void;
  // 市区町村コード → 塗る色。含まれない市区町村は「データなし」の色になる
  setAreaColors: (colors: ReadonlyMap<MunicipalityCode, string>) => void;
  // 押した市区町村の境界を強調する。null で解除
  selectArea: (code: MunicipalityCode | null) => void;
  setVisible: (layer: LayerId, visible: boolean) => void;
  // 背景を切り替える。ベクトルの地図のスタイルを取れなかったときは reject し、元の背景のままにする
  setBasemap: (id: BasemapId) => Promise<void>;
  getBasemap: () => BasemapId;
  flyTo: (center: LngLat, zoom: number) => void;
  // 吹き出しを開く（開いていれば置き換える）
  showPopup: (at: LngLat, content: PopupContent) => void;
  closePopup: () => void;
  // 開いている吹き出しの中身だけを差し替える。閉じていれば何もしない
  updatePopup: (content: PopupContent) => void;
  // 点の範囲に合わせて表示する（[西, 南, 東, 北]）
  fitBounds: (bounds: [number, number, number, number]) => void;
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

// ベクトルの地図のスタイルは一度だけ取りに行く。失敗したら次の切り替えで取り直す
const vectorStyles = new Map<string, Promise<StyleSpecification>>();

function loadVectorStyle(url: string): Promise<StyleSpecification> {
  let style = vectorStyles.get(url);
  if (!style) {
    style = fetch(url).then(async (response) => {
      if (!response.ok)
        throw new Error(`地図のスタイルを取得できませんでした（HTTP ${response.status}）`);
      return (await response.json()) as StyleSpecification;
    });
    style.catch(() => vectorStyles.delete(url));
    vectorStyles.set(url, style);
  }
  return style;
}

async function basemapParts(id: BasemapId): Promise<BasemapParts> {
  const basemap = BASEMAP_SOURCES[id];
  return basemap.kind === "raster"
    ? rasterParts(basemap)
    : vectorParts(await loadVectorStyle(basemap.styleUrl));
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

// ページ移動の切り替え（styles.css の @view-transition）は、移る前のページの見た目を写し取ってから動かす。
// 地図（WebGL の canvas）のあるページでは写し取れず、ブラウザが切り替えを飛ばして
// 「Uncaught (in promise) AbortError: Transition was skipped」を出す（2026-10、Chrome で確認）。
// 地図を作ったページだけ、離れるときの切り替えをやめる。地図のページへ入るときは地図がまだ無いので、これまでどおり動く。
function skipLeaveTransition(): void {
  if (document.getElementById("no-leave-transition")) return;
  const style = document.createElement("style");
  style.id = "no-leave-transition";
  style.textContent = "@view-transition { navigation: none; }";
  document.head.append(style);
}

export function createMap(
  container: HTMLElement,
  options: {
    initial?: { center: LngLat; zoom: number };
    onSelect: (s: Selection | null) => void;
    // false なら市区町村の境界（3MB）を読まない。成約事例の地図は駅の点だけを使う
    areas?: boolean;
    basemap?: BasemapId;
  },
): Promise<MapController> {
  skipLeaveTransition();
  const initial = options.initial ?? JAPAN;
  const withAreas = options.areas !== false;
  const map = new MapLibreMap({
    container,
    center: initial.center,
    zoom: initial.zoom,
    minZoom: 3.5,
    maxZoom: 18,
    attributionControl: { compact: true },
    style: {
      version: 8,
      sources: {
        ...(withAreas && {
          areas: {
            type: "geojson",
            data: { type: "FeatureCollection", features: [] },
            // properties.code を地物の id にし、feature-state で色と選択を持たせる
            promoteId: "code",
            attribution:
              '<a href="https://nlftp.mlit.go.jp/ksj/gml/datalist/KsjTmplt-N03-2026.html" target="_blank" rel="noopener">国土数値情報（行政区域データ）</a>（国土交通省）をもとに合同会社Maa\'un Japan 作成',
          },
        }),
      },
      // 背景は読み込み後に setBasemap で差し込む
      layers: [],
    },
  });
  map.addControl(new NavigationControl({ showCompass: false }), "top-right");
  // 地図の準備と並行して境界を取りに行く
  const boundaries: Promise<FeatureCollection | null> = withAreas
    ? loadBoundaries()
    : Promise.resolve(null);
  // 失敗は areasLoaded で伝える。地図の準備が終わる前に失敗しても未処理の reject にしない
  boundaries.catch(() => undefined);

  // 背景の部品。入れ替えるときに外す
  let basemap: BasemapId | null = null;
  let baseSources: string[] = [];
  let request = 0;
  let removed = false;
  const setBasemap = async (id: BasemapId): Promise<void> => {
    if (id === basemap) return;
    const token = ++request;
    const parts = await basemapParts(id);
    // 待つ間に別の背景が選ばれたか、地図を片付けたときは何もしない
    if (token !== request || removed) return;
    for (const layer of map.getLayersOrder()) {
      if (layer.startsWith(BASE_PREFIX)) map.removeLayer(layer);
    }
    for (const source of baseSources) map.removeSource(source);
    if (parts.glyphs) map.setGlyphs(parts.glyphs);
    if (parts.sprite) map.setSprite(parts.sprite);
    for (const [name, source] of Object.entries(parts.sources)) map.addSource(name, source);
    baseSources = Object.keys(parts.sources);
    // 背景を外した後なので、残っている一番下の部品が上に重ねるものの先頭。その下に入れる
    const beforeId = map.getLayersOrder()[0];
    for (const layer of parts.layers) map.addLayer(layer, beforeId);
    basemap = id;
  };

  return new Promise((resolve) => {
    map.on("load", () => {
      // 背景が取れなくても上の部品は使えるようにする。既定の背景で取り直す
      setBasemap(options.basemap ?? DEFAULT_BASEMAP).catch(() => setBasemap(DEFAULT_BASEMAP));
      for (const id of ["land", "stations", "condos"] as const) {
        map.addSource(id, { type: "geojson", data: collection([]) });
      }
      // 広域では市区町村の塗り分け、拡大すると地価と駅のポイントが見えるようにする。
      // 拡大するほど面を薄くし、背景の地図の地名や道路を読めるようにする。
      if (withAreas) addAreaLayers(map);
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
      // 成約事例の駅。色（坪単価）と大きさ（件数）は点ごとに持たせる。選んだ駅は濃い縁で示す
      const isPicked: ExpressionSpecification = ["==", ["get", "selected"], 1];
      map.addLayer({
        id: "condos",
        type: "circle",
        source: "condos",
        paint: {
          "circle-color": ["get", "color"],
          "circle-radius": [
            "interpolate",
            ["linear"],
            ["zoom"],
            7,
            ["*", 0.5, ["get", "size"]],
            14,
            ["*", 1.5, ["get", "size"]],
          ],
          "circle-opacity": 0.9,
          "circle-stroke-color": ["case", isPicked, "#2a2622", "#ffffff"],
          "circle-stroke-width": ["case", isPicked, 3, 1.5],
        },
      });

      // 上に描いたもの（成約事例 → 駅 → 地価 → 市区町村）を優先して選ぶ。
      const order: LayerId[] = ["condos", "stations", "land", "areas"].filter((id) =>
        map.getLayer(id),
      ) as LayerId[];
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

      // 吹き出しは 1 つだけ使い回す。地図の空いた所を押しても閉じない（閉じるのは × か closePopup）
      const popup = new Popup({ closeOnClick: false, maxWidth: "16rem", offset: 12 });

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
        if (!data) return;
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
          if (!map.getLayer(layer)) return;
          const value = visible ? "visible" : "none";
          map.setLayoutProperty(layer, "visibility", value);
          if (layer === "areas") map.setLayoutProperty("areas-outline", "visibility", value);
        },
        setBasemap,
        getBasemap: () => basemap ?? options.basemap ?? DEFAULT_BASEMAP,
        flyTo: (center, zoom) => map.flyTo({ center, zoom }),
        showPopup: (at, content) => {
          popup.setLngLat(at).setDOMContent(popupNode(content));
          if (!popup.isOpen()) popup.addTo(map);
        },
        closePopup: () => {
          popup.remove();
        },
        updatePopup: (content) => {
          if (popup.isOpen()) popup.setDOMContent(popupNode(content));
        },
        fitBounds: ([west, south, east, north]) =>
          map.fitBounds(
            [
              [west, south],
              [east, north],
            ],
            { padding: 40, maxZoom: 13, duration: 600 },
          ),
        destroy: () => {
          removed = true;
          map.remove();
        },
      });
    });
  });
}

function popupNode({ title, lines }: PopupContent): HTMLElement {
  const node = document.createElement("div");
  node.className = "map-popup";
  const heading = document.createElement("p");
  heading.className = "map-popup-title";
  heading.textContent = title;
  node.append(heading);
  for (const line of lines) {
    const p = document.createElement("p");
    p.textContent = line;
    node.append(p);
  }
  return node;
}

// 市区町村の面と境界線。
function addAreaLayers(map: MapLibreMap): void {
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
}
