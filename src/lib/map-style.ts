import type { Map as MapLibreMap } from "maplibre-gl";

/** 灰階夜間底圖。只影響 Dark style，不改青藍／橘色導航 overlay。 */
const GRAY = {
  background: "#2b2d32",
  water: "#3a3d43",
  land: "#33363c",
  park: "#30342f",
  building: "#40444b",
  buildingExtrusion: "#4a4e56",
  roadPath: "#5c6068",
  roadMinor: "#6d717a",
  roadMajor: "#8d919a",
  roadMotorway: "#b0b4bc",
  roadCasing: "#4f535b",
  roadLabel: "#f3f4f6",
  roadHalo: "#1f2126",
  place: "#e5e7eb",
  sky: "#3d4148",
  horizon: "#5c616a",
} as const;

const PAINT_UPDATES: Record<string, Record<string, string | number>> = {
  background: { "background-color": GRAY.background },
  water: { "fill-color": GRAY.water },
  waterway: { "line-color": GRAY.water },
  landcover_ice_shelf: { "fill-color": GRAY.background },
  landcover_glacier: { "fill-color": GRAY.background },
  landuse_residential: { "fill-color": GRAY.land },
  landcover_wood: { "fill-color": GRAY.park },
  landuse_park: { "fill-color": GRAY.park },
  building: { "fill-color": GRAY.building },
  road_area_pier: { "fill-color": GRAY.land },
  road_pier: { "line-color": GRAY.roadMinor },
  highway_path: { "line-color": GRAY.roadPath },
  highway_minor: { "line-color": GRAY.roadMinor },
  highway_major_casing: { "line-color": GRAY.roadCasing },
  highway_major_inner: { "line-color": GRAY.roadMajor },
  highway_major_subtle: { "line-color": GRAY.roadMinor },
  highway_motorway_casing: { "line-color": GRAY.roadCasing },
  highway_motorway_inner: { "line-color": GRAY.roadMotorway },
  highway_motorway_subtle: { "line-color": GRAY.roadMajor },
  railway_transit: { "line-color": "#5a5e66" },
  railway: { "line-color": "#5a5e66" },
  railway_minor: { "line-color": "#5a5e66" },
  highway_name_other: {
    "text-color": GRAY.roadLabel,
    "text-halo-color": GRAY.roadHalo,
  },
  highway_name_motorway: {
    "text-color": GRAY.roadLabel,
    "text-halo-color": GRAY.roadHalo,
  },
  place_city: { "text-color": GRAY.place },
  place_town: { "text-color": GRAY.place },
  place_city_large: { "text-color": "#ffffff" },
  place_suburb: { "text-color": "#d1d5db" },
  place_village: { "text-color": "#d1d5db" },
  place_other: { "text-color": "#c4c8ce" },
};

const HIDDEN_LAYERS = [
  "water_name",
  "road_oneway",
  "road_oneway_opposite",
  "aeroway-taxiway",
  "aeroway-runway-casing",
  "aeroway-area",
  "aeroway-runway",
];

const LABEL_LAYERS = [
  "highway_name_other",
  "highway_name_motorway",
  "place_city",
  "place_town",
  "place_city_large",
  "place_suburb",
  "place_village",
  "place_other",
];

export function applyDarkDrivingTheme(map: MapLibreMap) {
  for (const [layerId, paints] of Object.entries(PAINT_UPDATES)) {
    if (!map.getLayer(layerId)) continue;
    for (const [property, value] of Object.entries(paints)) {
      try {
        map.setPaintProperty(
          layerId,
          property as Parameters<MapLibreMap["setPaintProperty"]>[1],
          value,
        );
      } catch {
        // Layer exists but does not accept this paint property.
      }
    }
  }

  for (const layerId of HIDDEN_LAYERS) {
    if (!map.getLayer(layerId)) continue;
    map.setLayoutProperty(layerId, "visibility", "none");
  }

  for (const layerId of LABEL_LAYERS) {
    if (!map.getLayer(layerId)) continue;
    map.setLayoutProperty(layerId, "visibility", "visible");
    try {
      map.setPaintProperty(layerId, "text-halo-width", 1.2);
    } catch {
      /* some label layers may not accept halo width */
    }
  }

  if (!map.getLayer("building-3d") && map.getSource("openmaptiles")) {
    try {
      map.addLayer({
        id: "building-3d",
        source: "openmaptiles",
        "source-layer": "building",
        type: "fill-extrusion",
        minzoom: 14,
        paint: {
          "fill-extrusion-color": GRAY.buildingExtrusion,
          "fill-extrusion-height": [
            "coalesce",
            ["get", "render_height"],
            ["get", "height"],
            10,
          ],
          "fill-extrusion-base": [
            "coalesce",
            ["get", "render_min_height"],
            0,
          ],
          "fill-extrusion-opacity": 0.55,
        },
      });
    } catch {
      // 底圖尚未準備好 3D 建物時略過，不阻擋地圖載入。
    }
  }

  if (map.getLayer("building")) {
    map.setLayoutProperty(
      "building",
      "visibility",
      map.getLayer("building-3d") ? "none" : "visible",
    );
  }

  if (map.getLayer("building-3d")) {
    try {
      map.setPaintProperty("building-3d", "fill-extrusion-color", GRAY.buildingExtrusion);
      map.setPaintProperty("building-3d", "fill-extrusion-opacity", 0.55);
    } catch {
      /* keep existing extrusion */
    }
  }

  try {
    map.setSky({
      "sky-color": GRAY.sky,
      "sky-horizon-blend": 0.45,
      "horizon-color": GRAY.horizon,
      "horizon-fog-blend": 0.55,
      "fog-color": GRAY.background,
      "fog-ground-blend": 0.22,
    });
  } catch {
    // Sky atmosphere is optional on older MapLibre builds.
  }
}
