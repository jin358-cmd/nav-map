import type {
  ExpressionSpecification,
  GeoJSONSource,
  Map as MapLibreMap,
} from "maplibre-gl";
import {
  floatArrowPhaseCount,
  paintFlatArrow,
  paintFloatArrow,
  type ArrowPaintSide,
} from "@/lib/guidance-arrow-paint";
import type { GuidanceArrowMode } from "@/lib/guidance-arrow-mode";
import {
  emptyTurnArrowHold,
  stepTurnArrowHold,
  type TurnArrowHold,
  type TurnArrowSide,
} from "@/lib/turn-arrow-hold";
import {
  deriveGeometryTurn,
  lineLengthMeters,
  pointAlongRoute,
  sliceRouteAhead,
} from "@/lib/upcoming-route";
import type { CameraMode } from "@/types/domain";

export const GUIDANCE_SOURCE_ID = "navpilot-turn-arrows";
export const GUIDANCE_LAYER_ID = "navpilot-turn-arrows-layer";
export const TURN_LINE_SOURCE_ID = "navpilot-turn-line-v3";
export const TURN_LINE_GLOW_ID = "navpilot-turn-line-glow-v3";
export const TURN_LINE_LAYER_ID = "navpilot-turn-line-layer-v3";
const FLAT_ARROW_ID = "navpilot-flat-arrow-v1";
const FLOAT_ARROW_PREFIX = "navpilot-float-arrow-v1";
const STALE_TURN_IDS = [
  "navpilot-turn-line",
  "navpilot-turn-line-glow",
  "navpilot-turn-line-layer",
];

let arrowHold: TurnArrowHold = emptyTurnArrowHold();

function emptyCollection() {
  return { type: "FeatureCollection" as const, features: [] };
}

function emptyLine() {
  return { type: "FeatureCollection" as const, features: [] };
}

function floatImageId(side: ArrowPaintSide, phaseIndex: number) {
  return `${FLOAT_ARROW_PREFIX}-${side}-${phaseIndex}`;
}

function ensureImages(map: MapLibreMap) {
  const add = (id: string, image: ImageData | null, pixelRatio: number) => {
    if (!image || map.hasImage(id)) return;
    try {
      map.addImage(id, image, { pixelRatio });
    } catch {
      /* style swap may still hold the previous id for one frame */
    }
  };
  add(FLAT_ARROW_ID, paintFlatArrow(), 2);
  const phases = floatArrowPhaseCount();
  for (const side of ["left", "right"] as const) {
    for (let index = 0; index < phases; index += 1) {
      add(floatImageId(side, index), paintFloatArrow(side, index / phases), 2);
    }
  }
}

function turnGlowWidth(): ExpressionSpecification {
  return ["interpolate", ["linear"], ["zoom"], 12, 5, 17, 8];
}
function turnLineWidth(): ExpressionSpecification {
  return ["interpolate", ["linear"], ["zoom"], 12, 2.4, 17, 4.2];
}

/** Bright packets marching toward the head of the arrow. Stops stay sorted. */
function flowGradient(phase: number): ExpressionSpecification {
  const shift = ((phase % 1) + 1) % 1;
  const stops: unknown[] = ["interpolate", ["linear"], ["line-progress"]];
  const samples = 8;
  for (let index = 0; index <= samples; index += 1) {
    const t = index / samples;
    const wave = (t - shift + 1) % 1;
    const bright = wave < 0.16;
    stops.push(t, bright ? "#f8fafc" : "rgba(56, 189, 248, 0.28)");
  }
  return stops as ExpressionSpecification;
}

function stripStaleTurnLayers(map: MapLibreMap) {
  for (const id of STALE_TURN_IDS) {
    if (map.getLayer(id)) map.removeLayer(id);
  }
  if (map.getSource("navpilot-turn-line")) map.removeSource("navpilot-turn-line");
}

function ensureTurnLine(map: MapLibreMap) {
  stripStaleTurnLayers(map);
  const glowWidth = turnGlowWidth();
  const lineWidth = turnLineWidth();
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
        "line-opacity": 0.22,
        "line-blur": 3,
      },
      layout: { "line-cap": "round", "line-join": "round" },
    });
  } else {
    map.setPaintProperty(TURN_LINE_GLOW_ID, "line-width", glowWidth);
    map.setPaintProperty(TURN_LINE_GLOW_ID, "line-opacity", 0.22);
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

function arrowIconSize(floating: boolean) {
  // One sprite. Flat is a short road arrow; float stays under ~56px.
  return floating ? 0.58 : 0.72;
}

function ensureChevronLayer(
  map: MapLibreMap,
  floating: boolean,
  imageId: string,
) {
  const existing = map.getLayer(GUIDANCE_LAYER_ID);
  if (existing && "source" in existing && existing.source !== GUIDANCE_SOURCE_ID) {
    map.removeLayer(GUIDANCE_LAYER_ID);
  }
  // Flat: geographic bearing on the road plane.
  // Float: screen-facing billboard so the curve sits above the pavement.
  const rotate = floating
    ? 0
    : (["get", "bearing"] as ExpressionSpecification);
  const alignment = floating ? ("viewport" as const) : ("map" as const);
  const layout = {
    "icon-image": imageId,
    "icon-size": arrowIconSize(floating),
    "icon-anchor": "center" as const,
    "icon-offset": [0, 0] as [number, number],
    "icon-rotate": rotate,
    "icon-rotation-alignment": alignment,
    "icon-pitch-alignment": alignment,
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
  map.setLayoutProperty(GUIDANCE_LAYER_ID, "icon-image", imageId);
  map.setLayoutProperty(GUIDANCE_LAYER_ID, "icon-size", arrowIconSize(floating));
  map.setLayoutProperty(GUIDANCE_LAYER_ID, "icon-anchor", "center");
  map.setLayoutProperty(GUIDANCE_LAYER_ID, "icon-offset", [0, 0]);
  map.setLayoutProperty(GUIDANCE_LAYER_ID, "icon-rotate", rotate);
  map.setLayoutProperty(GUIDANCE_LAYER_ID, "icon-rotation-alignment", alignment);
  map.setLayoutProperty(GUIDANCE_LAYER_ID, "icon-pitch-alignment", alignment);
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

function prefersReducedMotion() {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

function sideFromGeometry(signed: number): TurnArrowSide | null {
  if (signed <= -12) return "left";
  if (signed >= 12) return "right";
  return null;
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
    arrowMode?: GuidanceArrowMode;
    heading?: number;
    offRoute?: boolean;
    stepId?: string | null;
    nowMs?: number;
  } = {},
) {
  if (!map.isStyleLoaded()) return;
  ensureImages(map);
  ensureTurnLine(map);

  const geometry = deriveGeometryTurn(route, routeMeters, 140);
  const upcomingSide = sideFromGeometry(geometry.signed);
  const exitAt = Number.isFinite(distanceToNext)
    ? routeMeters + Math.max(0, distanceToNext) + 14
    : routeMeters;
  const exit = pointAlongRoute(route, exitAt);
  const motionOff = prefersReducedMotion();
  const flowPhase = motionOff ? 0 : phase;
  const stepped = stepTurnArrowHold({
    previous: arrowHold,
    nowMs: options.nowMs ?? (typeof performance !== "undefined" ? performance.now() : 0),
    navigating,
    offRoute: options.offRoute === true,
    isTurn: options.isTurn === true,
    stepId: options.stepId ?? null,
    side: arrowHold.side ?? upcomingSide,
    routeMeters,
    distanceToApex: distanceToNext,
    exitBearing: exit?.bearing ?? null,
    heading: options.heading ?? exit?.bearing ?? 0,
  });
  arrowHold = stepped.hold;

  const mode: GuidanceArrowMode = options.arrowMode === "float" ? "float" : "flat";
  const side = stepped.hold.side ?? upcomingSide;
  const floating = mode === "float" && side != null;
  const apex = stepped.hold.apexMeters ?? routeMeters + Math.max(0, distanceToNext);
  const line =
    stepped.visible && route.length >= 2
      ? sliceRouteAhead(
          route,
          Math.max(0, routeMeters) + 6,
          Math.max(28, apex + 16 - routeMeters),
        )
      : [];
  const span = lineLengthMeters(line);
  const tip = line.length >= 2 ? pointAlongRoute(line, Math.max(0, span - 6)) : null;
  const floatAt =
    line.length >= 2 ? pointAlongRoute(line, Math.min(36, span * 0.45)) : null;
  const pose = floating ? floatAt : tip;
  const phaseIndex = motionOff
    ? 0
    : Math.floor((((flowPhase % 1) + 1) % 1) * floatArrowPhaseCount()) %
      floatArrowPhaseCount();
  const imageId =
    floating && side
      ? floatImageId(side, phaseIndex)
      : FLAT_ARROW_ID;

  if (process.env.NODE_ENV !== "production") {
    console.debug("[NavGuidance]", {
      navigating,
      visible: stepped.visible,
      reason: stepped.reason,
      mode,
      side,
      distanceToNext,
      routeMeters,
      arrowCount: pose && stepped.visible ? 1 : 0,
    });
  }

  const data = {
    type: "FeatureCollection" as const,
    features:
      stepped.visible && pose
        ? [
            {
              type: "Feature" as const,
              id: 0,
              properties: {
                bearing: pose.bearing,
                opacity: 0.94,
                scale: 1,
              },
              geometry: {
                type: "Point" as const,
                coordinates: [pose.lng, pose.lat],
              },
            },
          ]
        : [],
  };

  const source = map.getSource(GUIDANCE_SOURCE_ID);
  if (source?.type === "geojson") {
    (source as GeoJSONSource).setData(data);
  } else if (!source) {
    map.addSource(GUIDANCE_SOURCE_ID, { type: "geojson", data });
  }

  setTurnLine(map, mode === "flat" && stepped.visible ? line : []);
  if (map.getLayer(TURN_LINE_LAYER_ID)) {
    map.setPaintProperty(TURN_LINE_LAYER_ID, "line-gradient", flowGradient(flowPhase));
  }
  ensureChevronLayer(map, floating, imageId);
  stackGuidanceLayers(map);
}

export function resetGuidanceArrowCache() {
  arrowHold = emptyTurnArrowHold();
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
