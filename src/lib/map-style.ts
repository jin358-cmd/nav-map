import type { Map as MapLibreMap } from "maplibre-gl";
import { MAP_COLORS } from "@/lib/constants";

const PAINT_UPDATES: Record<string, Record<string, string | number>> = {
  background: { "background-color": MAP_COLORS.background },
  water: { "fill-color": MAP_COLORS.water },
  waterway: { "line-color": MAP_COLORS.water },
  landcover_ice_shelf: { "fill-color": MAP_COLORS.background },
  landcover_glacier: { "fill-color": MAP_COLORS.background },
  landuse_residential: { "fill-color": MAP_COLORS.land },
  landcover_wood: { "fill-color": MAP_COLORS.park },
  landuse_park: { "fill-color": MAP_COLORS.park },
  building: { "fill-color": MAP_COLORS.building },
  highway_path: { "line-color": "#2a3444" },
  highway_minor: { "line-color": MAP_COLORS.roadMinor },
  highway_major_casing: { "line-color": MAP_COLORS.roadCasing },
  highway_major_inner: { "line-color": MAP_COLORS.roadMajor },
  highway_major_subtle: { "line-color": MAP_COLORS.roadMinor },
  highway_motorway_casing: { "line-color": MAP_COLORS.roadCasing },
  highway_motorway_inner: { "line-color": MAP_COLORS.roadMotorway },
  highway_motorway_subtle: { "line-color": MAP_COLORS.roadMajor },
  railway_transit: { "line-color": "#2a3038" },
  railway: { "line-color": "#2a3038" },
  railway_minor: { "line-color": "#2a3038" },
  highway_name_other: { "text-color": MAP_COLORS.roadLabel },
  highway_name_motorway: { "text-color": MAP_COLORS.roadLabel },
  place_city: { "text-color": "#c5d0de" },
  place_town: { "text-color": "#a9b6c7" },
  place_city_large: { "text-color": "#d7e0ea" },
};

const HIDDEN_LAYERS = [
  "place_other",
  "place_suburb",
  "place_village",
  "place_state",
  "water_name",
  "road_oneway",
  "road_oneway_opposite",
  "aeroway-taxiway",
  "aeroway-runway-casing",
  "aeroway-area",
  "aeroway-runway",
];

export function applyDarkDrivingTheme(map: MapLibreMap) {
  for (const [layerId, paints] of Object.entries(PAINT_UPDATES)) {
    if (!map.getLayer(layerId)) continue;
    for (const [property, value] of Object.entries(paints)) {
      try {
        map.setPaintProperty(layerId, property, value);
      } catch {
        // Layer exists but does not accept this paint property.
      }
    }
  }

  for (const layerId of HIDDEN_LAYERS) {
    if (!map.getLayer(layerId)) continue;
    map.setLayoutProperty(layerId, "visibility", "none");
  }

  if (map.getLayer("building")) {
    map.setLayoutProperty("building", "visibility", "none");
  }

  if (!map.getLayer("building-3d") && map.getSource("openmaptiles")) {
    map.addLayer({
      id: "building-3d",
      source: "openmaptiles",
      "source-layer": "building",
      type: "fill-extrusion",
      minzoom: 14,
      paint: {
        "fill-extrusion-color": MAP_COLORS.buildingExtrusion,
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
        "fill-extrusion-opacity": 0.78,
      },
    });
  }

  try {
    map.setSky({
      "sky-color": "#07090d",
      "sky-horizon-blend": 0.55,
      "horizon-color": "#1a2433",
      "horizon-fog-blend": 0.75,
      "fog-color": MAP_COLORS.background,
      "fog-ground-blend": 0.35,
    });
  } catch {
    // Sky atmosphere is optional on older MapLibre builds.
  }
}
