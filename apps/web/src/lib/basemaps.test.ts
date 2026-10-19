import type { StyleSpecification } from "maplibre-gl";
import { describe, expect, it } from "vitest";
import { BASEMAP_SOURCES, isBasemapId, rasterParts, vectorParts } from "@/lib/basemaps";

describe("vectorParts", () => {
  const style: StyleSpecification = {
    version: 8,
    glyphs: "https://example.com/fonts/{fontstack}/{range}.pbf",
    sprite: "https://example.com/sprites/ofm",
    sources: { openmaptiles: { type: "vector", url: "https://example.com/planet" } },
    layers: [
      { id: "background", type: "background", paint: { "background-color": "#fff" } },
      { id: "building", type: "fill", source: "openmaptiles", "source-layer": "building" },
      {
        id: "place",
        type: "symbol",
        source: "openmaptiles",
        "source-layer": "place",
        layout: { "text-field": ["coalesce", ["get", "name_en"], ["get", "name"]] },
      },
      {
        id: "shield",
        type: "symbol",
        source: "openmaptiles",
        "source-layer": "transportation_name",
        layout: { "text-field": ["get", "ref"] },
      },
    ],
  };

  it("背景の部品の id とソースの参照に印を付ける", () => {
    const parts = vectorParts(style);
    expect(Object.keys(parts.sources)).toEqual(["base-openmaptiles"]);
    expect(parts.layers.map((l) => l.id)).toEqual([
      "base-background",
      "base-building",
      "base-place",
      "base-shield",
    ]);
    expect(parts.layers[1]).toMatchObject({ source: "base-openmaptiles" });
    expect(parts.glyphs).toBe(style.glyphs);
    expect(parts.sprite).toBe(style.sprite);
  });

  it("地名は日本語の名前を優先し、道路番号などはそのままにする", () => {
    const [, , place, shield] = vectorParts(style).layers;
    expect(place).toMatchObject({
      layout: { "text-field": ["coalesce", ["get", "name:ja"], ["get", "name"]] },
    });
    expect(shield).toMatchObject({ layout: { "text-field": ["get", "ref"] } });
  });
});

describe("rasterParts", () => {
  it("地理院タイルはズームレベル 18 までだけ取りに行き、出典を付ける", () => {
    const basemap = BASEMAP_SOURCES.photo;
    if (basemap.kind !== "raster") throw new Error("raster ではない");
    const { sources } = rasterParts(basemap);
    expect(sources["base-raster"]).toMatchObject({ maxzoom: 18 });
    expect(JSON.stringify(sources)).toContain("地理院タイル");
  });
});

describe("isBasemapId", () => {
  it("知らない値は背景として扱わない", () => {
    expect(isBasemapId("pale")).toBe(true);
    expect(isBasemapId("zenrin")).toBe(false);
    expect(isBasemapId(null)).toBe(false);
  });
});
