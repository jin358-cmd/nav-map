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

const LIGHT_WASH_SOURCE = "navpilot-light-wash";
const LIGHT_WASH_LAYER = "navpilot-light-wash-layer";

function applyLightDrivingTheme(map: MapLibreMap) {
  if (!map.getSource(LIGHT_WASH_SOURCE)) {
    map.addSource(LIGHT_WASH_SOURCE, {
      type: "geojson",
      data: {
        type: "Feature",
        properties: {},
        geometry: {
          type: "Polygon",
          coordinates: [
            [
              [-180, -85],
              [180, -85],
              [180, 85],
              [-180, 85],
              [-180, -85],
            ],
          ],
        },
      },
    });
  }
  if (!map.getLayer(LIGHT_WASH_LAYER)) {
    const firstSymbol = map
      .getStyle()
      ?.layers?.find((layer) => layer.type === "symbol")?.id;
    map.addLayer(
      {
        id: LIGHT_WASH_LAYER,
        type: "fill",
        source: LIGHT_WASH_SOURCE,
        paint: {
          "fill-color": "#1a1d24",
          "fill-opacity": 0.1,
        },
      },
      firstSymbol,
    );
  }
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
