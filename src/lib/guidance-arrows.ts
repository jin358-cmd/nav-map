import type {
  ExpressionSpecification,
  GeoJSONSource,
  Map as MapLibreMap,
} from "maplibre-gl";
import {
  shouldShowGroundBow,
  turnGuidanceLine,
  turnMarqueeArrows,
} from "@/lib/upcoming-route";
import type { CameraMode } from "@/types/domain";

export const GUIDANCE_SOURCE_ID = "navpilot-turn-arrows";
export const GUIDANCE_LAYER_ID = "navpilot-turn-arrows-layer";
export const TURN_LINE_SOURCE_ID = "navpilot-turn-line";
export const TURN_LINE_GLOW_ID = "navpilot-turn-line-glow";
export const TURN_LINE_LAYER_ID = "navpilot-turn-line-layer";
const CHEVRON_IMAGE_ID = "navpilot-ground-chevron-blue-v4";

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
  const size = 192;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.clearRect(0, 0, size, size);
  ctx.translate(size / 2, size / 2);

  ctx.save();
  ctx.shadowColor = "rgba(14, 165, 233, 0.95)";
  ctx.shadowBlur = 18;
  strokeChevron(ctx, 58, 48, 78, 28, "#075985");
  ctx.restore();
  strokeChevron(ctx, 56, 44, 72, 20, "#0284c7");
  strokeChevron(ctx, 52, 38, 64, 13, "#38bdf8");
  strokeChevron(ctx, 48, 32, 54, 6, "#e0f2fe");

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
  14,
  17,
  32,
];
const TURN_LINE_WIDTH: ExpressionSpecification = [
  "interpolate",
  ["linear"],
  ["zoom"],
  12,
  8,
  17,
  16,
];

function ensureTurnLine(map: MapLibreMap) {
  if (!map.getSource(TURN_LINE_SOURCE_ID)) {
    map.addSource(TURN_LINE_SOURCE_ID, {
      type: "geojson",
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
        "line-opacity": 0.36,
        "line-blur": 7,
      },
      layout: { "line-cap": "round", "line-join": "round" },
    });
  } else {
    map.setPaintProperty(TURN_LINE_GLOW_ID, "line-color", "#38bdf8");
    map.setPaintProperty(TURN_LINE_GLOW_ID, "line-width", TURN_GLOW_WIDTH);
    map.setPaintProperty(TURN_LINE_GLOW_ID, "line-opacity", 0.36);
    map.setPaintProperty(TURN_LINE_GLOW_ID, "line-blur", 7);
  }
  if (!map.getLayer(TURN_LINE_LAYER_ID)) {
    map.addLayer({
      id: TURN_LINE_LAYER_ID,
      type: "line",
      source: TURN_LINE_SOURCE_ID,
      paint: {
        "line-color": "#7dd3fc",
        "line-width": TURN_LINE_WIDTH,
        "line-opacity": 0.46,
      },
      layout: { "line-cap": "round", "line-join": "round" },
    });
  } else {
    map.setPaintProperty(TURN_LINE_LAYER_ID, "line-color", "#7dd3fc");
    map.setPaintProperty(TURN_LINE_LAYER_ID, "line-width", TURN_LINE_WIDTH);
    map.setPaintProperty(TURN_LINE_LAYER_ID, "line-opacity", 0.46);
  }
}

function chevronSize(): ExpressionSpecification {
  return [
    "interpolate",
    ["linear"],
    ["zoom"],
    14.2,
    ["*", ["get", "scale"], 0.92],
    16.2,
    ["*", ["get", "scale"], 1.32],
    17.4,
    ["*", ["get", "scale"], 1.62],
    18.4,
    ["*", ["get", "scale"], 1.86],
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
  const arrows =
    line.length >= 2 ? turnMarqueeArrows(line, phase, distanceToNext) : [];

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
