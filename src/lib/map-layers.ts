import type {
  ExpressionSpecification,
  GeoJSONSource,
  Map as MapLibreMap,
} from "maplibre-gl";
import { CCTV_LAYER_HIT_ID, CCTV_LAYER_ID } from "@/lib/cctv-constants";
import { MAP_COLORS } from "@/lib/constants";
import { sliceRouteAhead } from "@/lib/upcoming-route";
import {
  LEGACY_TRAFFIC_LAYER_ID,
  LEGACY_TRAFFIC_SOURCE_ID,
  TRAFFIC_LAYER_ID,
  TRAFFIC_SOURCE_ID,
} from "@/lib/traffic-constants";
import type { TrafficSegment } from "@/types/domain";

const TRAFFIC_COLOR: Record<string, string> = {
  smooth: "#22c55e",
  slow: "#facc15",
  congested: "#f97316",
  severe: "#ef4444",
  blocked: "#7f1d1d",
};

const TRAFFIC_WIDTH: ExpressionSpecification = [
  "interpolate",
  ["linear"],
  ["zoom"],
  12,
  [
    "match",
    ["get", "level"],
    "blocked",
    4.6,
    "severe",
    4.3,
    "congested",
    4,
    "slow",
    3.5,
    2,
  ],
  17,
  [
    "match",
    ["get", "level"],
    "blocked",
    11,
    "severe",
    10.4,
    "congested",
    10,
    "slow",
    8.5,
    5,
  ],
];

const TRAFFIC_OPACITY: ExpressionSpecification = [
  "match",
  ["get", "level"],
  "smooth",
  0.4,
  0.96,
];

const TRAFFIC_COLOR_EXPR: ExpressionSpecification = [
  "match",
  ["get", "level"],
  "smooth",
  TRAFFIC_COLOR.smooth,
  "slow",
  TRAFFIC_COLOR.slow,
  "congested",
  TRAFFIC_COLOR.congested,
  "severe",
  TRAFFIC_COLOR.severe,
  "blocked",
  TRAFFIC_COLOR.blocked,
  TRAFFIC_COLOR.slow,
];

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
  trafficVisible = true,
  routeMeters = 0,
) {
  const remaining =
    routeMeters > 8 ? sliceRouteAhead(route, routeMeters, 1_000_000) : route;
  const passed =
    routeMeters > 8 ? sliceRouteAhead(route, 0, Math.max(0, routeMeters - 4)) : [];
  const routeData = {
    type: "FeatureCollection" as const,
    features: [
      {
        type: "Feature" as const,
        properties: { kind: "remaining" },
        geometry: { type: "LineString" as const, coordinates: remaining },
      },
      {
        type: "Feature" as const,
        properties: { kind: "passed" },
        geometry: { type: "LineString" as const, coordinates: passed },
      },
    ],
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
          "line-color": TRAFFIC_COLOR_EXPR,
          "line-width": TRAFFIC_WIDTH,
          "line-opacity": TRAFFIC_OPACITY,
          "line-blur": 0.15,
        },
        layout: {
          "line-cap": "round",
          "line-join": "round",
        },
      },
      trafficBefore,
    );
  } else {
    map.setPaintProperty(TRAFFIC_LAYER_ID, "line-color", TRAFFIC_COLOR_EXPR);
    map.setPaintProperty(TRAFFIC_LAYER_ID, "line-width", TRAFFIC_WIDTH);
    map.setPaintProperty(TRAFFIC_LAYER_ID, "line-opacity", TRAFFIC_OPACITY);
    map.setPaintProperty(TRAFFIC_LAYER_ID, "line-blur", 0.15);
  }
  if (map.getLayer(TRAFFIC_LAYER_ID)) {
    map.setLayoutProperty(
      TRAFFIC_LAYER_ID,
      "visibility",
      trafficVisible ? "visible" : "none",
    );
  }

  if (!map.getLayer("demo-route-glow")) {
    map.addLayer({
      id: "demo-route-glow",
      type: "line",
      source: "demo-route",
      filter: ["==", ["get", "kind"], "remaining"],
      paint: {
        "line-color": MAP_COLORS.routeGlow,
        "line-width": ["interpolate", ["linear"], ["zoom"], 12, 8, 17, 18],
        "line-opacity": 0.28,
        "line-blur": 6,
      },
      layout: { "line-cap": "round", "line-join": "round" },
    });
  }

  if (!map.getLayer("demo-route-passed")) {
    map.addLayer({
      id: "demo-route-passed",
      type: "line",
      source: "demo-route",
      filter: ["==", ["get", "kind"], "passed"],
      paint: {
        "line-color": "#94a3b8",
        "line-width": ["interpolate", ["linear"], ["zoom"], 12, 2, 17, 4],
        "line-opacity": 0.22,
      },
      layout: { "line-cap": "round", "line-join": "round" },
    });
  }

  if (!map.getLayer("demo-route-line")) {
    map.addLayer({
      id: "demo-route-line",
      type: "line",
      source: "demo-route",
      filter: ["==", ["get", "kind"], "remaining"],
      paint: {
        "line-color": MAP_COLORS.route,
        "line-width": ["interpolate", ["linear"], ["zoom"], 12, 3, 17, 7.5],
        "line-opacity": 0.95,
      },
      layout: { "line-cap": "round", "line-join": "round" },
    });
  }
}
