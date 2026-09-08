import type {
  ExpressionSpecification,
  GeoJSONSource,
  Map as MapLibreMap,
} from "maplibre-gl";
import {
  shouldShowGroundBow,
  turnGroundArrows,
  turnGuidanceLine,
} from "@/lib/upcoming-route";
import type { CameraMode } from "@/types/domain";

export const GUIDANCE_SOURCE_ID = "navpilot-turn-arrows";
export const GUIDANCE_LAYER_ID = "navpilot-turn-arrows-layer";
export const TURN_LINE_SOURCE_ID = "navpilot-turn-line-v3";
export const TURN_LINE_GLOW_ID = "navpilot-turn-line-glow-v3";
export const TURN_LINE_LAYER_ID = "navpilot-turn-line-layer-v3";
const CHEVRON_IMAGE_ID = "navpilot-ground-chevron-blue-v5";
const STALE_TURN_IDS = [
  "navpilot-turn-line",
  "navpilot-turn-line-glow",
  "navpilot-turn-line-layer",
];

let showing = false;

function emptyCollection() {
  return { type: "FeatureCollection" as const, features: [] };
}

function emptyLine() {
  return {
    type: "Feature" as const,
    properties: {},
    geometry: { type: "LineString" as const, coordinates: [] as [number, number][] },
  };
}

function strokeChevron(
  ctx: CanvasRenderingContext2D,
  outer: number,
  inner: number,
  depth: number,
  width: number,
  color: string,
) {
  ctx.beginPath();
  ctx.moveTo(-depth, inner);
  ctx.lineTo(0, -outer);
  ctx.lineTo(depth, inner);
  ctx.lineWidth = width;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.strokeStyle = color;
  ctx.stroke();
}

function createChevronImage() {
  const size = 128;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.clearRect(0, 0, size, size);
  ctx.translate(size / 2, size / 2);

  ctx.save();
  ctx.shadowColor = "rgba(14, 165, 233, 0.85)";
  ctx.shadowBlur = 8;
  strokeChevron(ctx, 30, 22, 24, 9, "#0369a1");
  ctx.restore();
  strokeChevron(ctx, 28, 20, 22, 6, "#38bdf8");
  strokeChevron(ctx, 26, 18, 18, 3, "#f0f9ff");

  return ctx.getImageData(0, 0, size, size);
}

function ensureImages(map: MapLibreMap) {
  if (map.hasImage(CHEVRON_IMAGE_ID)) return;
  const image = createChevronImage();
  if (image) map.addImage(CHEVRON_IMAGE_ID, image, { pixelRatio: 2 });
}

const TURN_GLOW_WIDTH: ExpressionSpecification = [
  "interpolate",
  ["linear"],
  ["zoom"],
  12,
  6,
  17,
  12,
];
const TURN_LINE_WIDTH: ExpressionSpecification = [
  "interpolate",
  ["linear"],
  ["zoom"],
  12,
  3,
  17,
  7.5,
];

function flowGradient(phase: number): ExpressionSpecification {
  const p = 0.12 + (((phase % 1) + 1) % 1) * 0.76;
  return [
    "interpolate",
    ["linear"],
    ["line-progress"],
    0,
    "rgba(56, 189, 233, 0.14)",
    p - 0.1,
    "rgba(56, 189, 233, 0.2)",
    p,
    "#f8fafc",
    p + 0.1,
    "rgba(125, 211, 252, 0.55)",
    1,
    "rgba(56, 189, 233, 0.16)",
  ];
}

function stripStaleTurnLayers(map: MapLibreMap) {
  for (const id of STALE_TURN_IDS) {
    if (map.getLayer(id)) map.removeLayer(id);
  }
  if (map.getSource("navpilot-turn-line")) map.removeSource("navpilot-turn-line");
}

function ensureTurnLine(map: MapLibreMap) {
  stripStaleTurnLayers(map);
  if (!map.getSource(TURN_LINE_SOURCE_ID)) {
    map.addSource(TURN_LINE_SOURCE_ID, {
      type: "geojson",
      lineMetrics: true,
      data: emptyLine(),
    });
  }
  if (!map.getLayer(TURN_LINE_GLOW_ID)) {
    map.addLayer({
      id: TURN_LINE_GLOW_ID,
      type: "line",
      source: TURN_LINE_SOURCE_ID,
      paint: {
        "line-color": "#38bdf8",
        "line-width": TURN_GLOW_WIDTH,
        "line-opacity": 0.28,
        "line-blur": 4,
      },
      layout: { "line-cap": "round", "line-join": "round" },
    });
  } else {
    map.setPaintProperty(TURN_LINE_GLOW_ID, "line-width", TURN_GLOW_WIDTH);
    map.setPaintProperty(TURN_LINE_GLOW_ID, "line-opacity", 0.28);
  }
  if (!map.getLayer(TURN_LINE_LAYER_ID)) {
    map.addLayer({
      id: TURN_LINE_LAYER_ID,
      type: "line",
      source: TURN_LINE_SOURCE_ID,
      paint: {
        "line-width": TURN_LINE_WIDTH,
        "line-opacity": 0.92,
        "line-gradient": flowGradient(0),
      },
      layout: { "line-cap": "round", "line-join": "round" },
    });
  } else {
    map.setPaintProperty(TURN_LINE_LAYER_ID, "line-width", TURN_LINE_WIDTH);
    map.setPaintProperty(TURN_LINE_LAYER_ID, "line-opacity", 0.92);
  }
}

function chevronSize(): ExpressionSpecification {
  return [
    "interpolate",
    ["linear"],
    ["zoom"],
    14.2,
    ["*", ["get", "scale"], 0.12],
    16.2,
    ["*", ["get", "scale"], 0.16],
    17.4,
    ["*", ["get", "scale"], 0.2],
    18.6,
    ["*", ["get", "scale"], 0.24],
  ];
}

function ensureChevronLayer(map: MapLibreMap) {
  const layout = {
    "icon-image": CHEVRON_IMAGE_ID,
    "icon-size": chevronSize(),
    "icon-anchor": "center" as const,
    "icon-rotate": ["get", "bearing"] as ExpressionSpecification,
    "icon-rotation-alignment": "map" as const,
    "icon-pitch-alignment": "map" as const,
    "icon-allow-overlap": true,
    "icon-ignore-placement": true,
    "icon-padding": 0,
  };

  if (!map.getLayer(GUIDANCE_LAYER_ID)) {
    map.addLayer({
      id: GUIDANCE_LAYER_ID,
      type: "symbol",
      source: GUIDANCE_SOURCE_ID,
      layout,
      paint: {
        "icon-opacity": ["get", "opacity"],
      },
    });
    return;
  }

  map.setLayoutProperty(GUIDANCE_LAYER_ID, "icon-image", CHEVRON_IMAGE_ID);
  map.setLayoutProperty(GUIDANCE_LAYER_ID, "icon-size", chevronSize());
  map.setLayoutProperty(GUIDANCE_LAYER_ID, "icon-anchor", "center");
  map.setLayoutProperty(GUIDANCE_LAYER_ID, "icon-rotation-alignment", "map");
  map.setLayoutProperty(GUIDANCE_LAYER_ID, "icon-pitch-alignment", "map");
}

function stackGuidanceLayers(map: MapLibreMap) {
  for (const id of [
    "demo-route-glow",
    "demo-route-line",
    "demo-route-maneuver",
    TURN_LINE_GLOW_ID,
    TURN_LINE_LAYER_ID,
  ]) {
    if (map.getLayer(id)) map.moveLayer(id);
  }
  if (map.getLayer(GUIDANCE_LAYER_ID)) map.moveLayer(GUIDANCE_LAYER_ID);
}

function setTurnLine(map: MapLibreMap, line: [number, number][]) {
  const source = map.getSource(TURN_LINE_SOURCE_ID);
  const data =
    line.length >= 2
      ? {
          type: "Feature" as const,
          properties: {},
          geometry: { type: "LineString" as const, coordinates: line },
        }
      : emptyLine();
  if (source?.type === "geojson") {
    (source as GeoJSONSource).setData(data);
  }
}

export function upsertGuidanceArrows(
  map: MapLibreMap,
  route: [number, number][] = [],
  routeMeters = 0,
  distanceToNext = Number.POSITIVE_INFINITY,
  navigating = false,
  phase = 0,
  options: {
    cameraMode?: CameraMode;
    isTurn?: boolean;
    cueMeters?: number;
    fade?: number;
  } = {},
) {
  if (!map.isStyleLoaded()) return;
  ensureImages(map);
  ensureTurnLine(map);

  const live =
    navigating &&
    options.isTurn === true &&
    shouldShowGroundBow(distanceToNext, showing);
  showing = live;

  const line =
    live && route.length >= 2
      ? turnGuidanceLine(
          route,
          routeMeters,
          distanceToNext,
          options.cueMeters,
          true,
        )
      : [];
  const arrows = live
    ? turnGroundArrows({
        route,
        routeMeters,
        distanceToNext,
        cueMeters: options.cueMeters,
        phase,
        wasShowing: true,
      })
    : [];

  const data = {
    type: "FeatureCollection" as const,
    features: arrows.map((arrow, index) => ({
      type: "Feature" as const,
      id: index,
      properties: {
        bearing: arrow.bearing,
        opacity: arrow.opacity,
        scale: arrow.scale,
      },
      geometry: {
        type: "Point" as const,
        coordinates: [arrow.lng, arrow.lat],
      },
    })),
  };

  const source = map.getSource(GUIDANCE_SOURCE_ID);
  if (source?.type === "geojson") {
    (source as GeoJSONSource).setData(data);
  } else if (!source) {
    map.addSource(GUIDANCE_SOURCE_ID, { type: "geojson", data });
  }

  setTurnLine(map, line);
  if (map.getLayer(TURN_LINE_LAYER_ID)) {
    map.setPaintProperty(TURN_LINE_LAYER_ID, "line-gradient", flowGradient(phase));
  }
  ensureChevronLayer(map);
  stackGuidanceLayers(map);
}

export function resetGuidanceArrowCache() {
  showing = false;
}

export function clearGuidanceArrows(map: MapLibreMap) {
  resetGuidanceArrowCache();
  const arrows = map.getSource(GUIDANCE_SOURCE_ID);
  if (arrows?.type === "geojson") {
    (arrows as GeoJSONSource).setData(emptyCollection());
  }
  const line = map.getSource(TURN_LINE_SOURCE_ID);
  if (line?.type === "geojson") {
    (line as GeoJSONSource).setData(emptyLine());
  }
}
