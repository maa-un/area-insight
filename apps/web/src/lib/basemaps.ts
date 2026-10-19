import type {
  ExpressionSpecification,
  LayerSpecification,
  SourceSpecification,
  StyleSpecification,
} from "maplibre-gl";

// 地図の背景。どれも無料で、出典の表示だけで使える（2026-10 に各提供元の案内で確認）。
//   地理院タイル: https://maps.gsi.go.jp/development/ichiran.html
//     出典は「地理院タイル」とし、一覧ページへリンクする。タイルによって個別の出所の明示が要る
//     （淡色地図の広域は VMAP0、写真の広域は Landsat8・世界衛星モザイク画像など）。ズームレベルは 18 まで
//   OpenFreeMap: https://openfreemap.org/ 。キー不要。ベクトルタイルは 14 まで用意され、それより先は MapLibre が拡大して描く。
//     出典（OpenFreeMap、© OpenMapTiles、© OpenStreetMap contributors）はタイルの TileJSON が返すものをそのまま表示する
// 型だけを読み、MapLibre 本体はここで読み込まない（画面の部品からも使うため）。

export type BasemapId = "pale" | "std" | "photo" | "osm";

export const BASEMAPS: { id: BasemapId; label: string; description: string }[] = [
  { id: "pale", label: "淡色", description: "国土地理院の淡色地図" },
  { id: "std", label: "標準", description: "国土地理院の標準地図" },
  { id: "photo", label: "写真", description: "国土地理院の航空写真" },
  { id: "osm", label: "建物", description: "建物の形が見える地図（OpenStreetMap）" },
];

export const DEFAULT_BASEMAP: BasemapId = "pale";

export function isBasemapId(value: unknown): value is BasemapId {
  return BASEMAPS.some((b) => b.id === value);
}

const GSI =
  '<a href="https://maps.gsi.go.jp/development/ichiran.html" target="_blank" rel="noopener">地理院タイル</a>';

type RasterBasemap = { kind: "raster"; url: string; attribution: string };
type VectorBasemap = { kind: "vector"; styleUrl: string };

export const BASEMAP_SOURCES: Record<BasemapId, RasterBasemap | VectorBasemap> = {
  pale: {
    kind: "raster",
    url: "https://cyberjapandata.gsi.go.jp/xyz/pale/{z}/{x}/{y}.png",
    // ズームレベル 2〜8 の日本の周辺以外は VMAP0 から作られており、指定の文言を添える
    attribution: `${GSI}（Shoreline data is derived from: United States. National Imagery and Mapping Agency. "Vector Map Level 0 (VMAP0)." Bethesda, MD: Denver, CO: The Agency; USGS Information Services, 1997.）`,
  },
  std: {
    kind: "raster",
    url: "https://cyberjapandata.gsi.go.jp/xyz/std/{z}/{x}/{y}.png",
    attribution: GSI,
  },
  photo: {
    kind: "raster",
    url: "https://cyberjapandata.gsi.go.jp/xyz/seamlessphoto/{z}/{x}/{y}.jpg",
    // 広域（ズームレベル 2〜13）は衛星画像から作られており、それぞれ指定の出所を添える
    attribution: `${GSI}（データソース：Landsat8画像（GSI,TSIC,GEO Grid/AIST）, Landsat8画像（courtesy of the U.S. Geological Survey）, 海底地形（GEBCO）、GRUS画像（© Axelspace）。Images on 世界衛星モザイク画像 obtained from site https://lpdaac.usgs.gov/data_access maintained by the NASA Land Processes Distributed Active Archive Center (LP DAAC), USGS/Earth Resources Observation and Science (EROS) Center, Sioux Falls, South Dakota, (Year). Source of image data product.）`,
  },
  osm: { kind: "vector", styleUrl: "https://tiles.openfreemap.org/styles/liberty" },
};

// 地理院タイルの範囲。これより先のタイルは無いので取りに行かない
export const GSI_ZOOM = { min: 2, max: 18 };

// 背景の部品の id に付ける印。上に重ねる市区町村や地点の部品と取り違えないようにする
export const BASE_PREFIX = "base-";

// 背景を描く部品（ソースとレイヤー）。上に重ねる部品の下に差し込む
export type BasemapParts = {
  sources: Record<string, SourceSpecification>;
  layers: LayerSpecification[];
  glyphs?: string;
  sprite?: string;
};

export function rasterParts(basemap: RasterBasemap): BasemapParts {
  const id = `${BASE_PREFIX}raster`;
  return {
    sources: {
      [id]: {
        type: "raster",
        tiles: [basemap.url],
        tileSize: 256,
        minzoom: GSI_ZOOM.min,
        maxzoom: GSI_ZOOM.max,
        attribution: basemap.attribution,
      },
    },
    layers: [{ id, type: "raster", source: id }],
  };
}

// 地名を日本語で出す。元のスタイルは「ローマ字 + 現地語」を並べるため、日本語の名前があればそれだけにする
const JAPANESE_NAME: ExpressionSpecification = ["coalesce", ["get", "name:ja"], ["get", "name"]];

// ベクトルの地図のスタイルを、上の部品と並べられる形にする。id に印を付け、ソースの参照も合わせて変える
export function vectorParts(style: StyleSpecification): BasemapParts {
  const sources: Record<string, SourceSpecification> = {};
  for (const [name, source] of Object.entries(style.sources)) {
    sources[`${BASE_PREFIX}${name}`] = source;
  }
  const layers = style.layers.map((layer): LayerSpecification => {
    const next = { ...layer, id: `${BASE_PREFIX}${layer.id}` } as LayerSpecification;
    if ("source" in layer && typeof layer.source === "string") {
      (next as { source: string }).source = `${BASE_PREFIX}${layer.source}`;
    }
    if (
      layer.type === "symbol" &&
      JSON.stringify(layer.layout?.["text-field"] ?? "").includes("name")
    ) {
      (next as typeof layer).layout = { ...layer.layout, "text-field": JAPANESE_NAME };
    }
    return next;
  });
  // 複数のスプライトを並べる形（配列）は使っていないので、URL 1 つの形だけを受け取る
  const sprite = typeof style.sprite === "string" ? style.sprite : undefined;
  return { sources, layers, glyphs: style.glyphs, sprite };
}

const STORAGE_KEY = "machinome:basemap";

export function readStoredBasemap(): BasemapId {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    return isBasemapId(value) ? value : DEFAULT_BASEMAP;
  } catch {
    return DEFAULT_BASEMAP;
  }
}

export function storeBasemap(id: BasemapId): void {
  try {
    localStorage.setItem(STORAGE_KEY, id);
  } catch {
    // プライベートモードなどで保存できなくても、このページの中では切り替えられる
  }
}
