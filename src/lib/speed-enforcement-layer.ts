import type { GeoJSONSource, Map as MapLibreMap } from "maplibre-gl";
import {
  SPEED_ENFORCEMENT_LABEL_LAYER_ID,
  SPEED_ENFORCEMENT_LAYER_ID,
  SPEED_ENFORCEMENT_SOURCE_ID,
} from "@/lib/speed-enforcement-constants";
import type { SpeedEnforcementPoint } from "@/types/domain";

function toCollection(points: SpeedEnforcementPoint[]) {
  return {
    type: "FeatureCollection" as const,
    features: points.map((point) => ({
      type: "Feature" as const,
      properties: {
        id: point.id,
        address: point.address,
        direction: point.direction,
        speedLimit: point.speedLimit ?? 0,
      },
      geometry: {
        type: "Point" as const,
        coordinates: [point.location.lng, point.location.lat],
      },
    })),
  };
}

export function upsertSpeedEnforcementLayer(
  map: MapLibreMap,
  points: SpeedEnforcementPoint[],
) {
  const data = toCollection(points);
  const source = map.getSource(SPEED_ENFORCEMENT_SOURCE_ID);
  if (source?.type === "geojson") {
    (source as GeoJSONSource).setData(data);
  } else if (!source) {
    map.addSource(SPEED_ENFORCEMENT_SOURCE_ID, {
      type: "geojson",
      data,
      attribution:
        '<a href="https://data.tgos.tw/" target="_blank" rel="noopener noreferrer">內政部 TGOS 測速執法</a>',
    });
  }

  if (!map.getLayer(SPEED_ENFORCEMENT_LAYER_ID)) {
    map.addLayer({
      id: SPEED_ENFORCEMENT_LAYER_ID,
      type: "circle",
      source: SPEED_ENFORCEMENT_SOURCE_ID,
      minzoom: 10.5,
      paint: {
        "circle-color": "#fbbf24",
        "circle-radius": [
          "interpolate",
          ["linear"],
          ["zoom"],
          10.5,
          6,
          14,
          10,
          17,
          13,
        ],
        "circle-stroke-color": "#1c1917",
        "circle-stroke-width": 2.5,
        "circle-opacity": 0.96,
      },
    });
  }

  if (!map.getLayer(SPEED_ENFORCEMENT_LABEL_LAYER_ID)) {
    map.addLayer({
      id: SPEED_ENFORCEMENT_LABEL_LAYER_ID,
      type: "symbol",
      source: SPEED_ENFORCEMENT_SOURCE_ID,
      minzoom: 12,
      layout: {
        "text-field": [
          "case",
          [">", ["get", "speedLimit"], 0],
          ["to-string", ["get", "speedLimit"]],
          "測",
        ],
        "text-font": ["Noto Sans Regular"],
        "text-size": [
          "interpolate",
          ["linear"],
          ["zoom"],
          12,
          8,
          17,
          11,
        ],
        "text-allow-overlap": true,
        "text-ignore-placement": true,
      },
      paint: {
        "text-color": "#1c1917",
        "text-halo-color": "rgba(255,255,255,0.35)",
        "text-halo-width": 0.5,
      },
    });
  }
}
