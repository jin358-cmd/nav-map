import type {
  ExpressionSpecification,
  GeoJSONSource,
  Map as MapLibreMap,
} from "maplibre-gl";
import {
  deriveGeometryTurn,
  guidanceArrowsAlong,
  lineLengthMeters,
  marqueeSpacingMeters,
  planNavGuidance,
  shouldShowGroundBow,
  sliceRouteAhead,
  turnGuidanceLine,
  turnMarqueeArrows,
} from "@/lib/upcoming-route";
import type { CameraMode } from "@/types/domain";

export const GUIDANCE_SOURCE_ID = "navpilot-turn-arrows";
export const GUIDANCE_LAYER_ID = "navpilot-turn-arrows-layer";
export const TURN_LINE_SOURCE_ID = "navpilot-turn-line-v3";
export const TURN_LINE_GLOW_ID = "navpilot-turn-line-glow-v3";
export const TURN_LINE_LAYER_ID = "navpilot-turn-line-layer-v3";
const CHEVRON_IMAGE_ID = "navpilot-ground-chevron-yellow-v14";
const COMPACT_MAP_WIDTH = 640;
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
  return { type: "FeatureCollection" as const, features: [] };
}

function isCompactMap(map: MapLibreMap) {
  return map.getContainer().clientWidth < COMPACT_MAP_WIDTH;
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

  // Yellow filled ^ on the cyan route; 3D uses map pitch so it sits on the road.
  const chevronPath = () => {
    ctx.beginPath();
    ctx.moveTo(0, -4);
    ctx.lineTo(-44, 56);
    ctx.lineTo(-18, 58);
    ctx.lineTo(0, 20);
    ctx.lineTo(18, 58);
    ctx.lineTo(44, 56);
    ctx.closePath();
  };

  ctx.save();
  ctx.shadowColor = "rgba(69, 26, 3, 0.92)";
  ctx.shadowBlur = 18;
  chevronPath();
  ctx.fillStyle = "#713f12";
  ctx.fill();
  ctx.restore();

  chevronPath();
  ctx.fillStyle = "#facc15";
  ctx.fill();
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  ctx.lineWidth = 7;
  ctx.strokeStyle = "#a16207";
  ctx.stroke();

  return ctx.getImageData(0, 0, size, size);
}

function ensureImages(map: MapLibreMap) {
  if (map.hasImage(CHEVRON_IMAGE_ID)) return;
  const image = createChevronImage();
  if (!image) return;
  try {
    map.addImage(CHEVRON_IMAGE_ID, image, { pixelRatio: 2 });
  } catch {
    /* style swap may still hold the previous id for one frame */
  }
}

function turnGlowWidth(compact: boolean): ExpressionSpecification {
  return [
    "interpolate",
    ["linear"],
    ["zoom"],
    12,
    compact ? 10 : 6,
    17,
    compact ? 20 : 12,
  ];
}
function turnLineWidth(compact: boolean): ExpressionSpecification {
  return [
    "interpolate",
    ["linear"],
    ["zoom"],
    12,
    compact ? 5.5 : 3,
    17,
    compact ? 12 : 7.5,
  ];
}

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
    "#facc15",
    p + 0.1,
    "rgba(250, 204, 21, 0.55)",
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

function ensureTurnLine(map: MapLibreMap, compact: boolean) {
  stripStaleTurnLayers(map);
  const glowWidth = turnGlowWidth(compact);
  const lineWidth = turnLineWidth(compact);
  if (!map.getSource(TURN_LINE_SOURCE_ID)) {
    map.addSource(TURN_LINE_SOURCE_ID, {
      type: "geojson",
      lineMetrics: true,
      data: emptyLine(),
    });
    // lineMetrics sources must keep valid FeatureCollections; empty LineString
    // coordinates poison symbol/line rendering until the next style reload.
  }
  if (!map.getLayer(TURN_LINE_GLOW_ID)) {
    map.addLayer({
      id: TURN_LINE_GLOW_ID,
      type: "line",
      source: TURN_LINE_SOURCE_ID,
      paint: {
        "line-color": "#38bdf8",
        "line-width": glowWidth,
        "line-opacity": compact ? 0.4 : 0.28,
        "line-blur": compact ? 5 : 4,
      },
      layout: { "line-cap": "round", "line-join": "round" },
    });
  } else {
    map.setPaintProperty(TURN_LINE_GLOW_ID, "line-width", glowWidth);
    map.setPaintProperty(TURN_LINE_GLOW_ID, "line-opacity", compact ? 0.4 : 0.28);
  }
  if (!map.getLayer(TURN_LINE_LAYER_ID)) {
    map.addLayer({
      id: TURN_LINE_LAYER_ID,
      type: "line",
      source: TURN_LINE_SOURCE_ID,
      paint: {
        "line-width": lineWidth,
        "line-opacity": 0.95,
        "line-gradient": flowGradient(0),
      },
      layout: { "line-cap": "round", "line-join": "round" },
    });
  } else {
    map.setPaintProperty(TURN_LINE_LAYER_ID, "line-width", lineWidth);
    map.setPaintProperty(TURN_LINE_LAYER_ID, "line-opacity", 0.95);
  }
}

function chevronSize(compact: boolean, pitched: boolean): ExpressionSpecification {
  const boost = (compact ? 1.55 : 1) * (pitched ? 2 : 1.28);
  return [
    "interpolate",
    ["linear"],
    ["zoom"],
    14.2,
    ["*", ["get", "scale"], 0.36 * boost],
    16.2,
    ["*", ["get", "scale"], 0.5 * boost],
    17.4,
    ["*", ["get", "scale"], 0.64 * boost],
    18.6,
    ["*", ["get", "scale"], 0.76 * boost],
  ];
}

function ensureChevronLayer(map: MapLibreMap, compact: boolean, pitched: boolean) {
  const existing = map.getLayer(GUIDANCE_LAYER_ID);
  if (existing && "source" in existing && existing.source !== GUIDANCE_SOURCE_ID) {
    map.removeLayer(GUIDANCE_LAYER_ID);
  }
  const layout = {
    "icon-image": CHEVRON_IMAGE_ID,
    "icon-size": chevronSize(compact, pitched),
    "icon-anchor": "center" as const,
    "icon-offset": [0, 0] as [number, number],
    "icon-rotate": ["get", "bearing"] as ExpressionSpecification,
    "icon-rotation-alignment": "map" as const,
    "icon-pitch-alignment": "map" as const,
    "icon-keep-upright": false,
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

  map.setLayoutProperty(GUIDANCE_LAYER_ID, "symbol-placement", "point");
  map.setLayoutProperty(GUIDANCE_LAYER_ID, "icon-image", CHEVRON_IMAGE_ID);
  map.setLayoutProperty(GUIDANCE_LAYER_ID, "icon-size", chevronSize(compact, pitched));
  map.setLayoutProperty(GUIDANCE_LAYER_ID, "icon-anchor", "center");
  map.setLayoutProperty(GUIDANCE_LAYER_ID, "icon-offset", [0, 0]);
  map.setLayoutProperty(GUIDANCE_LAYER_ID, "icon-rotate", ["get", "bearing"]);
  map.setLayoutProperty(GUIDANCE_LAYER_ID, "icon-rotation-alignment", "map");
  map.setLayoutProperty(GUIDANCE_LAYER_ID, "icon-pitch-alignment", "map");
  map.setLayoutProperty(GUIDANCE_LAYER_ID, "icon-keep-upright", false);
  map.setLayoutProperty(GUIDANCE_LAYER_ID, "icon-allow-overlap", true);
  map.setLayoutProperty(GUIDANCE_LAYER_ID, "icon-ignore-placement", true);
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
          type: "FeatureCollection" as const,
          features: [
            {
              type: "Feature" as const,
              properties: {},
              geometry: { type: "LineString" as const, coordinates: line },
            },
          ],
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
  const compact = isCompactMap(map);
  const pitched = (options.cameraMode ?? "3d") === "3d";
  ensureImages(map);
  ensureTurnLine(map, compact);

  const geometry = deriveGeometryTurn(route, routeMeters);
  const plan = planNavGuidance({
    navigating,
    routeLength: route.length,
    distanceToNext,
    isTurnStep: options.isTurn === true,
    geometryTurn: geometry.isTurn,
  });
  const bow =
    plan.showTurnBow && shouldShowGroundBow(distanceToNext, showing);
  showing = bow;

  const cruiseAhead =
    plan.near200 || plan.showTurnBow ? 220 : compact || pitched ? 176 : 120;
  let line =
    plan.showGuidanceLine && route.length >= 2
      ? bow
        ? turnGuidanceLine(
            route,
            routeMeters,
            distanceToNext,
            options.cueMeters,
            true,
          )
        : sliceRouteAhead(route, Math.max(0, routeMeters) + 6, cruiseAhead)
      : [];
  if (plan.showGuidanceLine && line.length < 2 && navigating && route.length >= 2) {
    line = sliceRouteAhead(route, Math.max(0, routeMeters) + 4, cruiseAhead);
  }
  const arrows =
    plan.showChevrons && line.length >= 2
      ? bow
        ? turnMarqueeArrows(line, phase, distanceToNext)
        : guidanceArrowsAlong(
            line,
            marqueeSpacingMeters(lineLengthMeters(line), 16.5, distanceToNext),
            phase,
            plan.near150 ? 1 : compact ? 0.92 : 0.82,
          )
      : [];

  if (process.env.NODE_ENV !== "production") {
    console.debug("[NavGuidance]", {
      navigating,
      isTurn: plan.isTurn,
      isTurnStep: options.isTurn === true,
      geometryTurn: geometry.isTurn,
      distanceToNext,
      routeMeters,
      cueMeters: options.cueMeters,
      routeLength: route.length,
      compact,
      pitched,
      arrowCount: arrows.length,
      linePoints: line.length,
    });
  }
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
  ensureChevronLayer(map, compact, pitched);
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
