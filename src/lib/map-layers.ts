import type { GeoJSONSource, Map as MapLibreMap } from "maplibre-gl";
import { CCTV_LAYER_HIT_ID, CCTV_LAYER_ID } from "@/lib/cctv-constants";
import { MAP_COLORS } from "@/lib/constants";
import {
  LEGACY_TRAFFIC_LAYER_ID,
  LEGACY_TRAFFIC_SOURCE_ID,
  TRAFFIC_LAYER_ID,
  TRAFFIC_SOURCE_ID,
} from "@/lib/traffic-constants";
import type { TrafficSegment } from "@/types/domain";

const TRAFFIC_COLOR: Record<string, string> = {
  smooth: "#3ee0ff",
  slow: "#ffb020",
  congested: MAP_COLORS.congestion,
  blocked: MAP_COLORS.accident,
};

function removeLayer(map: MapLibreMap, id: string) {
  if (map.getLayer(id)) map.removeLayer(id);
}

function removeSource(map: MapLibreMap, id: string) {
  if (map.getSource(id)) map.removeSource(id);
}

export function upsertIntelligenceLayers(
  map: MapLibreMap,
  route: [number, number][],
  traffic: TrafficSegment[],
) {
  const routeData = {
    type: "Feature" as const,
    properties: {},
    geometry: { type: "LineString" as const, coordinates: route },
  };

  const trafficData = {
    type: "FeatureCollection" as const,
    features: traffic.map((segment) => ({
      type: "Feature" as const,
      properties: {
        id: segment.id,
        level: segment.level,
        name: segment.name,
        sourceType: segment.sourceType,
      },
      geometry: {
        type: "LineString" as const,
        coordinates: segment.coordinates,
      },
    })),
  };

  const routeSource = map.getSource("demo-route");
  if (routeSource?.type === "geojson") {
    (routeSource as GeoJSONSource).setData(routeData);
  } else if (!routeSource) {
    map.addSource("demo-route", { type: "geojson", data: routeData });
  }

  removeLayer(map, LEGACY_TRAFFIC_LAYER_ID);
  removeSource(map, LEGACY_TRAFFIC_SOURCE_ID);

  const trafficSource = map.getSource(TRAFFIC_SOURCE_ID);
  if (trafficSource?.type === "geojson") {
    (trafficSource as GeoJSONSource).setData(trafficData);
  } else if (!trafficSource) {
    map.addSource(TRAFFIC_SOURCE_ID, { type: "geojson", data: trafficData });
  }

  const trafficBefore = map.getLayer(CCTV_LAYER_HIT_ID)
    ? CCTV_LAYER_HIT_ID
    : map.getLayer(CCTV_LAYER_ID)
      ? CCTV_LAYER_ID
      : map.getLayer("demo-route-glow")
        ? "demo-route-glow"
        : undefined;

  if (!map.getLayer(TRAFFIC_LAYER_ID)) {
    map.addLayer(
      {
        id: TRAFFIC_LAYER_ID,
        type: "line",
        source: TRAFFIC_SOURCE_ID,
        paint: {
          "line-color": [
            "match",
            ["get", "level"],
            "smooth",
            TRAFFIC_COLOR.smooth,
            "slow",
            TRAFFIC_COLOR.slow,
            "congested",
            TRAFFIC_COLOR.congested,
            "blocked",
            TRAFFIC_COLOR.blocked,
            TRAFFIC_COLOR.slow,
          ],
          "line-width": ["interpolate", ["linear"], ["zoom"], 12, 2.4, 17, 7],
          "line-opacity": 0.88,
          "line-blur": 0.4,
        },
        layout: {
          "line-cap": "round",
          "line-join": "round",
        },
      },
      trafficBefore,
    );
  }

  if (!map.getLayer("demo-route-glow")) {
    map.addLayer({
      id: "demo-route-glow",
      type: "line",
      source: "demo-route",
      paint: {
        "line-color": MAP_COLORS.routeGlow,
        "line-width": ["interpolate", ["linear"], ["zoom"], 12, 8, 17, 18],
        "line-opacity": 0.28,
        "line-blur": 6,
      },
      layout: { "line-cap": "round", "line-join": "round" },
    });
  }

  if (!map.getLayer("demo-route-line")) {
    map.addLayer({
      id: "demo-route-line",
      type: "line",
      source: "demo-route",
      paint: {
        "line-color": MAP_COLORS.route,
        "line-width": ["interpolate", ["linear"], ["zoom"], 12, 3, 17, 7.5],
        "line-opacity": 0.95,
      },
      layout: { "line-cap": "round", "line-join": "round" },
    });
  }
}
