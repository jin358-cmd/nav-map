import type {
  ExpressionSpecification,
  GeoJSONSource,
  Map as MapLibreMap,
} from "maplibre-gl";
import { paintFlatArrow, paintFloatArrow } from "@/lib/guidance-arrow-paint";
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
export const TURN_LINE_SIDE_ID = "navpilot-turn-line-side-v3";
export const TURN_LINE_EDGE_ID = "navpilot-turn-line-edge-v3";
export const TURN_LINE_LAYER_ID = "navpilot-turn-line-layer-v3";
const FLAT_ARROW_ID = "navpilot-flat-arrow-v3";
const FLOAT_ARROW_ID = "navpilot-float-arrow-v3";
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
  add(FLOAT_ARROW_ID, paintFloatArrow("right", 0), 2);
}

function turnShadowWidth(): ExpressionSpecification {
  return ["interpolate", ["linear"], ["zoom"], 12, 9, 17, 14];
}
function turnEdgeWidth(): ExpressionSpecification {
  // About 2px of dark outline on each side of the amber body.
  return ["interpolate", ["linear"], ["zoom"], 12, 11, 17, 16];
}
function turnLineWidth(): ExpressionSpecification {
  return ["interpolate", ["linear"], ["zoom"], 12, 7, 17, 12];
}

/** Bright packets marching toward the head of the arrow. Stops stay sorted. */
function flowGradient(phase: number): ExpressionSpecification {
  const shift = ((phase % 1) + 1) % 1;
  const stops: unknown[] = ["interpolate", ["linear"], ["line-progress"]];
  const samples = 8;
  for (let index = 0; index <= samples; index += 1) {
    const t = index / samples;
    const wave = (t - shift + 1) % 1;
    const bright = wave < 0.1;
    stops.push(t, bright ? "#fde68a" : "#f59e0b");
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
  const shadowWidth = turnShadowWidth();
  const edgeWidth = turnEdgeWidth();
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
        "line-color": "#111827",
        "line-width": shadowWidth,
        "line-opacity": 0.28,
        "line-blur": 4,
        "line-translate": [0, 3],
        "line-translate-anchor": "map",
      },
      layout: { "line-cap": "round", "line-join": "round" },
    });
  } else {
    map.setPaintProperty(TURN_LINE_GLOW_ID, "line-width", shadowWidth);
    map.setPaintProperty(TURN_LINE_GLOW_ID, "line-color", "#111827");
  }
  if (!map.getLayer(TURN_LINE_SIDE_ID)) {
    map.addLayer({
      id: TURN_LINE_SIDE_ID,
      type: "line",
      source: TURN_LINE_SOURCE_ID,
      paint: {
        "line-color": "#1f2937",
        "line-width": edgeWidth,
        "line-opacity": 0,
        "line-offset": 0,
      },
      layout: { "line-cap": "round", "line-join": "round" },
    });
  }
  if (!map.getLayer(TURN_LINE_EDGE_ID)) {
    map.addLayer({
      id: TURN_LINE_EDGE_ID,
      type: "line",
      source: TURN_LINE_SOURCE_ID,
      paint: {
        "line-color": "#1f2937",
        "line-width": edgeWidth,
        "line-opacity": 1,
      },
      layout: { "line-cap": "round", "line-join": "round" },
    });
  } else {
    map.setPaintProperty(TURN_LINE_EDGE_ID, "line-width", edgeWidth);
  }
  if (!map.getLayer(TURN_LINE_LAYER_ID)) {
    map.addLayer({
      id: TURN_LINE_LAYER_ID,
      type: "line",
      source: TURN_LINE_SOURCE_ID,
      paint: {
        "line-width": lineWidth,
        "line-opacity": 1,
        "line-gradient": flowGradient(0),
      },
      layout: { "line-cap": "round", "line-join": "round" },
    });
  } else {
    map.setPaintProperty(TURN_LINE_LAYER_ID, "line-width", lineWidth);
    map.setPaintProperty(TURN_LINE_LAYER_ID, "line-opacity", 1);
  }
}

function liftRibbon(map: MapLibreMap, floating: boolean) {
  for (const id of [TURN_LINE_SIDE_ID, TURN_LINE_EDGE_ID, TURN_LINE_LAYER_ID]) {
    if (!map.getLayer(id)) continue;
    map.setPaintProperty(id, "line-translate", [0, 0]);
    map.setPaintProperty(id, "line-translate-anchor", "map");
    map.setPaintProperty(id, "line-offset", 0);
  }
  if (map.getLayer(TURN_LINE_SIDE_ID)) {
    map.setPaintProperty(TURN_LINE_SIDE_ID, "line-opacity", 0);
  }
  if (map.getLayer(TURN_LINE_GLOW_ID)) {
    const drop: [number, number] = floating ? [0, 4] : [0, 2];
    map.setPaintProperty(TURN_LINE_GLOW_ID, "line-translate", drop);
    map.setPaintProperty(TURN_LINE_GLOW_ID, "line-translate-anchor", "map");
    map.setPaintProperty(TURN_LINE_GLOW_ID, "line-opacity", floating ? 0.5 : 0.22);
    map.setPaintProperty(TURN_LINE_GLOW_ID, "line-blur", floating ? 6 : 3);
  }
}

function arrowIconSize() {
  // Head is about 2.5× the ribbon body (~11px at nav zoom).
  return 0.62;
}

function ensureChevronLayer(
  map: MapLibreMap,
  _floating: boolean,
  imageId: string,
) {
  const existing = map.getLayer(GUIDANCE_LAYER_ID);
  if (existing && "source" in existing && existing.source !== GUIDANCE_SOURCE_ID) {
    map.removeLayer(GUIDANCE_LAYER_ID);
  }
  // Both heads sit on the route. No screen-space lift.
  const rotate = ["get", "bearing"] as ExpressionSpecification;
  const alignment = "map" as const;
  const layout = {
    "icon-image": imageId,
    "icon-size": arrowIconSize(),
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
        "icon-translate": [0, 0],
        "icon-translate-anchor": "map",
      },
    });
    return;
  }

  map.setLayoutProperty(GUIDANCE_LAYER_ID, "symbol-placement", "point");
  map.setLayoutProperty(GUIDANCE_LAYER_ID, "icon-image", imageId);
  map.setLayoutProperty(GUIDANCE_LAYER_ID, "icon-size", arrowIconSize());
  if (map.getLayer(GUIDANCE_LAYER_ID)) {
    map.setPaintProperty(GUIDANCE_LAYER_ID, "icon-translate", [0, 0]);
    map.setPaintProperty(GUIDANCE_LAYER_ID, "icon-translate-anchor", "map");
  }
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
    TURN_LINE_SIDE_ID,
    TURN_LINE_EDGE_ID,
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
  const floating = mode === "float";
  const apex = stepped.hold.apexMeters ?? routeMeters + Math.max(0, distanceToNext);
  const clearance = 18;
  const start = Math.max(0, routeMeters + clearance);
  const pastCorner = Math.max(0, apex - start);
  const line =
    stepped.visible && route.length >= 2
      ? sliceRouteAhead(route, start, Math.max(48, pastCorner + 42))
      : [];
  const span = lineLengthMeters(line);
  const headAlong =
    pastCorner > 4 ? Math.min(Math.max(0, span - 3), pastCorner + 12) : Math.min(Math.max(0, span - 3), 14);
  const pose = line.length >= 2 ? pointAlongRoute(line, headAlong) : null;
  const imageId = floating ? FLOAT_ARROW_ID : FLAT_ARROW_ID;

  if (process.env.NODE_ENV !== "production") {
    console.debug("[NavGuidance]", {
      navigating,
      visible: stepped.visible,
      reason: stepped.reason,
      mode,
      side: stepped.hold.side ?? upcomingSide,
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

  setTurnLine(map, stepped.visible ? line : []);
  if (map.getLayer(TURN_LINE_LAYER_ID)) {
    map.setPaintProperty(TURN_LINE_LAYER_ID, "line-gradient", flowGradient(flowPhase));
  }
  liftRibbon(map, floating && stepped.visible);
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
