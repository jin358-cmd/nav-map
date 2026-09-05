import type { Map as MapLibreMap, StyleSpecification } from "maplibre-gl";
import { OPENFREEMAP_DARK_STYLE } from "@/lib/constants";
import { applyDarkDrivingTheme } from "@/lib/map-style";

export const OPENFREEMAP_LIGHT_STYLE =
  "https://tiles.openfreemap.org/styles/liberty";

export const SATELLITE_ATTRIBUTION =
  "Tiles © Esri — Source: Esri, Maxar, Earthstar Geographics · Labels © OpenStreetMap contributors © CARTO";

export const SATELLITE_STREET_STYLE: StyleSpecification = {
  version: 8,
  name: "satellite-streets",
  sources: {
    "esri-imagery": {
      type: "raster",
      tiles: [
        "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
      ],
      tileSize: 256,
      attribution: SATELLITE_ATTRIBUTION,
      maxzoom: 19,
    },
    "carto-labels": {
      type: "raster",
      tiles: [
        "https://a.basemaps.cartocdn.com/rastertiles/voyager_only_labels/{z}/{x}/{y}@2x.png",
      ],
      tileSize: 256,
      attribution: "© OpenStreetMap contributors © CARTO",
      maxzoom: 20,
    },
  },
  layers: [
    { id: "satellite-raster", type: "raster", source: "esri-imagery" },
    { id: "satellite-labels", type: "raster", source: "carto-labels" },
  ],
};

export function basemapStyle(
  resolved: "light" | "dark" | "satellite",
): string | StyleSpecification {
  if (resolved === "light") return OPENFREEMAP_LIGHT_STYLE;
  if (resolved === "satellite") return SATELLITE_STREET_STYLE;
  return OPENFREEMAP_DARK_STYLE;
}

function colorLuminance(value: unknown): number | null {
  if (value && typeof value === "object") {
    const color = value as { r?: number; g?: number; b?: number };
    if (
      typeof color.r === "number" &&
      typeof color.g === "number" &&
      typeof color.b === "number"
    ) {
      const scale = color.r > 1 || color.g > 1 || color.b > 1 ? 255 : 1;
      return (0.2126 * color.r + 0.7152 * color.g + 0.0722 * color.b) / scale;
    }
    if (typeof (value as { toString?: () => string }).toString === "function") {
      const text = String(value);
      if (text && text !== "[object Object]") return colorLuminance(text);
    }
  }
  if (typeof value !== "string") return null;
  const hex = value.trim().match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (hex) {
    let raw = hex[1];
    if (raw.length === 3) {
      raw = raw.split("").map((part) => part + part).join("");
    }
    const n = Number.parseInt(raw, 16);
    const r = (n >> 16) & 255;
    const g = (n >> 8) & 255;
    const b = n & 255;
    return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  }
  const rgb = value.match(/rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)/i);
  if (!rgb) return null;
  return (
    (0.2126 * Number(rgb[1]) + 0.7152 * Number(rgb[2]) + 0.0722 * Number(rgb[3])) /
    255
  );
}

export function detectAppliedBasemap(
  map: MapLibreMap,
): "light" | "dark" | "satellite" | "unknown" {
  try {
    if (map.getSource("esri-imagery") || map.getStyle()?.name === "satellite-streets") {
      return "satellite";
    }
    const luminance = colorLuminance(map.getPaintProperty("background", "background-color"));
    if (luminance == null) return "unknown";
    return luminance > 0.45 ? "light" : "dark";
  } catch {
    return "unknown";
  }
}

function applyLightDrivingTheme(map: MapLibreMap) {
  if (map.getSource("openmaptiles") && !map.getLayer("building-3d")) {
    try {
      map.addLayer({
        id: "building-3d",
        source: "openmaptiles",
        "source-layer": "building",
        type: "fill-extrusion",
        minzoom: 14,
        paint: {
          "fill-extrusion-color": "#d7d2c8",
          "fill-extrusion-height": [
            "coalesce",
            ["get", "render_height"],
            ["get", "height"],
            10,
          ],
          "fill-extrusion-opacity": 0.55,
        },
      });
    } catch {
      /* 亮色底圖可能沒有建物圖層 */
    }
  }
}

export function applyResolvedTheme(
  map: MapLibreMap,
  resolved: "light" | "dark" | "satellite",
) {
  if (resolved === "dark") {
    applyDarkDrivingTheme(map);
    return;
  }
  if (resolved === "light") {
    applyLightDrivingTheme(map);
  }
}
