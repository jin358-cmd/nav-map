import type {
  ExpressionSpecification,
  GeoJSONSource,
  Map as MapLibreMap,
} from "maplibre-gl";
import { MAP_COLORS } from "@/lib/constants";
import {
  maneuverMarqueeIntensity,
  sliceManeuverHighlight,
} from "@/lib/maneuver-guidance";
import {
  guidanceArrowsAlong,
  lineLengthMeters,
  marqueeSpacingMeters,
  shouldShowGuidanceArrows,
} from "@/lib/upcoming-route";
import type { CameraMode } from "@/types/domain";

export const GUIDANCE_SOURCE_ID = "guidance-arrows";
export const GUIDANCE_PATH_SOURCE_ID = "guidance-path";
export const GUIDANCE_LAYER_ID = "guidance-arrows-layer";
export const GUIDANCE_PATH_LAYER_ID = "guidance-path-layer";
export const GUIDANCE_PATH_GLOW_ID = "guidance-path-glow";
const CHEVRON_STRAIGHT_ID = "floating-orange-arrow-v3-straight";
const CHEVRON_LEFT_ID = "floating-orange-arrow-v3-left";
const CHEVRON_RIGHT_ID = "floating-orange-arrow-v3-right";

let lastAhead: [number, number][] = [];

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

/** 懸空橘色箭頭。圖檔朝北，旋轉跟 route tangent；轉彎形用 bend。 */
function createOrangeArrowImage(kind: "straight" | "left" | "right") {
  const size = 128;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  ctx.clearRect(0, 0, size, size);
  ctx.translate(size / 2, size / 2);
  ctx.shadowColor = "rgba(249, 115, 22, 0.28)";
  ctx.shadowBlur = 6;
  ctx.fillStyle = MAP_COLORS.maneuver;
  ctx.strokeStyle = "#ffedd5";
  ctx.lineWidth = 4;
  ctx.lineJoin = "round";
  ctx.lineCap = "round";

  ctx.beginPath();
  if (kind === "straight") {
    ctx.moveTo(0, -50);
    ctx.lineTo(34, 8);
    ctx.lineTo(14, 8);
    ctx.lineTo(14, 46);
    ctx.lineTo(-14, 46);
    ctx.lineTo(-14, 8);
    ctx.lineTo(-34, 8);
  } else if (kind === "left") {
    ctx.moveTo(12, 48);
    ctx.lineTo(-10, 48);
    ctx.lineTo(-10, 4);
    ctx.quadraticCurveTo(-10, -10, -24, -10);
    ctx.lineTo(-24, 6);
    ctx.lineTo(-50, -12);
    ctx.lineTo(-24, -34);
    ctx.lineTo(-24, -20);
    ctx.quadraticCurveTo(12, -20, 12, 6);
  } else {
    ctx.moveTo(-12, 48);
    ctx.lineTo(10, 48);
    ctx.lineTo(10, 4);
    ctx.quadraticCurveTo(10, -10, 24, -10);
    ctx.lineTo(24, 6);
    ctx.lineTo(50, -12);
    ctx.lineTo(24, -34);
    ctx.lineTo(24, -20);
    ctx.quadraticCurveTo(-12, -20, -12, 6);
  }
  ctx.closePath();
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.stroke();

  return ctx.getImageData(0, 0, size, size);
}

function ensureImages(map: MapLibreMap) {
  const images: Array<["straight" | "left" | "right", string]> = [
    ["straight", CHEVRON_STRAIGHT_ID],
    ["left", CHEVRON_LEFT_ID],
    ["right", CHEVRON_RIGHT_ID],
  ];
  for (const [kind, id] of images) {
    if (map.hasImage(id)) continue;
    const image = createOrangeArrowImage(kind);
    if (image) map.addImage(id, image, { pixelRatio: 2 });
  }
}

function floatingArrowSize(): ExpressionSpecification {
  return [
    "interpolate",
    ["linear"],
    ["zoom"],
    14.5,
    ["*", ["get", "scale"], 1.05],
    16.2,
    ["*", ["get", "scale"], 1.32],
    17.2,
    ["*", ["get", "scale"], 1.52],
    18.2,
    ["*", ["get", "scale"], 1.68],
    19,
    ["*", ["get", "scale"], 1.78],
  ];
}

function floatingArrowImage(): ExpressionSpecification {
  return [
    "match",
    ["get", "kind"],
    "left",
    CHEVRON_LEFT_ID,
    "right",
    CHEVRON_RIGHT_ID,
    CHEVRON_STRAIGHT_ID,
  ];
}

function ensureChevronLayer(map: MapLibreMap, cameraMode: CameraMode = "3d") {
  const size = floatingArrowSize();
  const image = floatingArrowImage();
  const offset: [number, number] = cameraMode === "3d" ? [0, -36] : [0, -12];
  const layout = {
    "icon-image": image,
    "icon-size": size,
    "icon-anchor": "bottom" as const,
    "icon-offset": offset,
    "icon-rotate": ["get", "bearing"] as ExpressionSpecification,
    "icon-rotation-alignment": "map" as const,
    "icon-pitch-alignment": "viewport" as const,
    "icon-allow-overlap": true,
    "icon-ignore-placement": true,
    "icon-padding": 2,
  };

  if (!map.getLayer(GUIDANCE_LAYER_ID)) {
    map.addLayer({
      id: GUIDANCE_LAYER_ID,
      type: "symbol",
      source: GUIDANCE_SOURCE_ID,
      layout,
      paint: {
        "icon-opacity": ["get", "opacity"],
        "icon-halo-color": MAP_COLORS.maneuverGlow,
        "icon-halo-width": 0.18,
      },
    });
    return;
  }

  map.setLayoutProperty(GUIDANCE_LAYER_ID, "icon-image", image);
  map.setLayoutProperty(GUIDANCE_LAYER_ID, "icon-size", size);
  map.setLayoutProperty(GUIDANCE_LAYER_ID, "icon-anchor", "bottom");
  map.setLayoutProperty(GUIDANCE_LAYER_ID, "icon-offset", offset);
  map.setLayoutProperty(GUIDANCE_LAYER_ID, "icon-rotation-alignment", "map");
  map.setLayoutProperty(GUIDANCE_LAYER_ID, "icon-pitch-alignment", "viewport");
}

function ensureHiddenPathLayers(map: MapLibreMap) {
  if (!map.getLayer(GUIDANCE_PATH_GLOW_ID)) {
    map.addLayer({
      id: GUIDANCE_PATH_GLOW_ID,
      type: "line",
      source: GUIDANCE_PATH_SOURCE_ID,
      paint: {
        "line-color": MAP_COLORS.maneuverGlow,
        "line-width": 1,
        "line-opacity": 0,
      },
    });
  } else {
    map.setPaintProperty(GUIDANCE_PATH_GLOW_ID, "line-opacity", 0);
  }

  if (!map.getLayer(GUIDANCE_PATH_LAYER_ID)) {
    map.addLayer({
      id: GUIDANCE_PATH_LAYER_ID,
      type: "line",
      source: GUIDANCE_PATH_SOURCE_ID,
      paint: {
        "line-color": MAP_COLORS.maneuver,
        "line-width": 1,
        "line-opacity": 0,
      },
    });
  } else {
    map.setPaintProperty(GUIDANCE_PATH_LAYER_ID, "line-opacity", 0);
  }
}

function stackGuidanceLayers(map: MapLibreMap) {
  for (const id of ["demo-route-glow", "demo-route-line", "demo-route-maneuver"]) {
    if (map.getLayer(id)) map.moveLayer(id);
  }
  if (map.getLayer(GUIDANCE_LAYER_ID)) map.moveLayer(GUIDANCE_LAYER_ID);
}

export function upsertGuidanceArrows(
  map: MapLibreMap,
  route: [number, number][],
  routeMeters: number,
  distanceToNext: number,
  navigating: boolean,
  phase: number,
  options: {
    cameraMode?: CameraMode;
    isTurn?: boolean;
    cueMeters?: number;
    fade?: number;
  } = {},
) {
  ensureImages(map);

  const live =
    navigating &&
    options.isTurn !== false &&
    shouldShowGuidanceArrows(distanceToNext);
  const fade = Math.max(0, Math.min(1, options.fade ?? 0));
  const intensity = live
    ? maneuverMarqueeIntensity(distanceToNext)
    : fade * 0.55;

  let ahead: [number, number][] = [];
  if (live && intensity > 0) {
    ahead = sliceManeuverHighlight(
      route,
      routeMeters,
      options.cueMeters ?? routeMeters + distanceToNext,
      distanceToNext,
    );
    lastAhead = ahead;
  } else if (!live && fade > 0.05 && lastAhead.length >= 2) {
    ahead = lastAhead;
  } else {
    lastAhead = [];
  }

  const show = ahead.length >= 2 && intensity > 0.05;
  const spacing = show
    ? marqueeSpacingMeters(
        lineLengthMeters(ahead),
        map.getZoom(),
        live ? distanceToNext : 40,
      )
    : 12;
  const arrows = show ? guidanceArrowsAlong(ahead, spacing, phase, intensity) : [];

  const arrowData = {
    type: "FeatureCollection" as const,
    features: arrows.map((arrow, index) => ({
      type: "Feature" as const,
      id: index,
      properties: {
        bearing: arrow.bearing,
        opacity: arrow.opacity,
        kind: arrow.kind,
        scale: arrow.scale,
      },
      geometry: {
        type: "Point" as const,
        coordinates: [arrow.lng, arrow.lat],
      },
    })),
  };

  const pathSource = map.getSource(GUIDANCE_PATH_SOURCE_ID);
  if (pathSource?.type === "geojson") {
    (pathSource as GeoJSONSource).setData(emptyLine());
  } else if (!pathSource) {
    map.addSource(GUIDANCE_PATH_SOURCE_ID, { type: "geojson", data: emptyLine() });
  }

  const arrowSource = map.getSource(GUIDANCE_SOURCE_ID);
  if (arrowSource?.type === "geojson") {
    (arrowSource as GeoJSONSource).setData(arrowData);
  } else if (!arrowSource) {
    map.addSource(GUIDANCE_SOURCE_ID, { type: "geojson", data: arrowData });
  }

  ensureHiddenPathLayers(map);
  ensureChevronLayer(map, options.cameraMode ?? "3d");
  stackGuidanceLayers(map);
}

export function resetGuidanceArrowCache() {
  lastAhead = [];
}

export function clearGuidanceArrows(map: MapLibreMap) {
  resetGuidanceArrowCache();
  const path = map.getSource(GUIDANCE_PATH_SOURCE_ID);
  if (path?.type === "geojson") (path as GeoJSONSource).setData(emptyLine());
  const arrows = map.getSource(GUIDANCE_SOURCE_ID);
  if (arrows?.type === "geojson") (arrows as GeoJSONSource).setData(emptyCollection());
}
