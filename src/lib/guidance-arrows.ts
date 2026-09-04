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
  shouldShowGuidanceArrows,
} from "@/lib/upcoming-route";
import type { CameraMode } from "@/types/domain";

export const GUIDANCE_SOURCE_ID = "guidance-arrows";
export const GUIDANCE_PATH_SOURCE_ID = "guidance-path";
export const GUIDANCE_LAYER_ID = "guidance-arrows-layer";
export const GUIDANCE_PATH_LAYER_ID = "guidance-path-layer";
export const GUIDANCE_PATH_GLOW_ID = "guidance-path-glow";
const CHEVRON_IMAGE_ID = "maneuver-marquee-chevron-v1";

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

function createChevronImage() {
  const size = 128;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  ctx.clearRect(0, 0, size, size);
  ctx.translate(size / 2, size / 2);

  ctx.fillStyle = "rgba(124, 45, 18, 0.28)";
  ctx.beginPath();
  ctx.ellipse(0, 28, 22, 7, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(0, -38);
  ctx.lineTo(30, 10);
  ctx.lineTo(14, 10);
  ctx.lineTo(14, 34);
  ctx.lineTo(-14, 34);
  ctx.lineTo(-14, 10);
  ctx.lineTo(-30, 10);
  ctx.closePath();
  ctx.fillStyle = MAP_COLORS.maneuver;
  ctx.fill();
  ctx.strokeStyle = "#ffedd5";
  ctx.lineWidth = 4;
  ctx.lineJoin = "round";
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(0, -24);
  ctx.lineTo(12, 2);
  ctx.lineTo(5, 2);
  ctx.lineTo(5, 22);
  ctx.lineTo(-5, 22);
  ctx.lineTo(-5, 2);
  ctx.lineTo(-12, 2);
  ctx.closePath();
  ctx.fillStyle = "rgba(255, 237, 213, 0.55)";
  ctx.fill();

  return ctx.getImageData(0, 0, size, size);
}

function ensureImages(map: MapLibreMap) {
  if (map.hasImage(CHEVRON_IMAGE_ID)) return;
  const image = createChevronImage();
  if (!image) return;
  map.addImage(CHEVRON_IMAGE_ID, image, { pixelRatio: 2 });
}

function ensureChevronLayer(map: MapLibreMap) {
  const size = [
    "interpolate",
    ["linear"],
    ["zoom"],
    14,
    0.52,
    17,
    0.78,
    19,
    0.92,
  ] as ExpressionSpecification;

  if (!map.getLayer(GUIDANCE_LAYER_ID)) {
    map.addLayer({
      id: GUIDANCE_LAYER_ID,
      type: "symbol",
      source: GUIDANCE_SOURCE_ID,
      layout: {
        "icon-image": CHEVRON_IMAGE_ID,
        "icon-size": size,
        "icon-anchor": "center",
        "icon-rotate": ["get", "bearing"],
        "icon-rotation-alignment": "map",
        "icon-pitch-alignment": "map",
        "icon-allow-overlap": true,
        "icon-ignore-placement": true,
      },
      paint: {
        "icon-opacity": ["get", "opacity"],
        "icon-halo-color": MAP_COLORS.maneuverGlow,
        "icon-halo-width": 1.2,
      },
    });
    return;
  }

  map.setLayoutProperty(GUIDANCE_LAYER_ID, "icon-image", CHEVRON_IMAGE_ID);
  map.setLayoutProperty(GUIDANCE_LAYER_ID, "icon-size", size);
  map.setLayoutProperty(GUIDANCE_LAYER_ID, "icon-anchor", "center");
  map.setLayoutProperty(GUIDANCE_LAYER_ID, "icon-pitch-alignment", "map");
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
  } = {},
) {
  ensureImages(map);

  const intensity = maneuverMarqueeIntensity(distanceToNext);
  const show =
    navigating &&
    options.cameraMode !== "2d" &&
    options.isTurn !== false &&
    shouldShowGuidanceArrows(distanceToNext) &&
    intensity > 0;

  const ahead = show
    ? sliceManeuverHighlight(
        route,
        routeMeters,
        options.cueMeters ?? routeMeters + distanceToNext,
        distanceToNext,
      )
    : [];
  const arrows = show ? guidanceArrowsAlong(ahead, 18, phase, intensity) : [];

  const pathData =
    ahead.length >= 2
      ? {
          type: "Feature" as const,
          properties: {},
          geometry: { type: "LineString" as const, coordinates: ahead },
        }
      : emptyLine();

  const arrowData = {
    type: "FeatureCollection" as const,
    features: arrows.map((arrow, index) => ({
      type: "Feature" as const,
      id: index,
      properties: {
        bearing: arrow.bearing,
        opacity: arrow.opacity,
      },
      geometry: {
        type: "Point" as const,
        coordinates: [arrow.lng, arrow.lat],
      },
    })),
  };

  const pathSource = map.getSource(GUIDANCE_PATH_SOURCE_ID);
  if (pathSource?.type === "geojson") {
    (pathSource as GeoJSONSource).setData(pathData);
  } else if (!pathSource) {
    map.addSource(GUIDANCE_PATH_SOURCE_ID, { type: "geojson", data: pathData });
  }

  const arrowSource = map.getSource(GUIDANCE_SOURCE_ID);
  if (arrowSource?.type === "geojson") {
    (arrowSource as GeoJSONSource).setData(arrowData);
  } else if (!arrowSource) {
    map.addSource(GUIDANCE_SOURCE_ID, { type: "geojson", data: arrowData });
  }

  if (!map.getLayer(GUIDANCE_PATH_GLOW_ID)) {
    map.addLayer({
      id: GUIDANCE_PATH_GLOW_ID,
      type: "line",
      source: GUIDANCE_PATH_SOURCE_ID,
      paint: {
        "line-color": MAP_COLORS.maneuverGlow,
        "line-width": ["interpolate", ["linear"], ["zoom"], 14, 8, 19, 16],
        "line-opacity": 0.2,
        "line-blur": 7,
      },
      layout: { "line-cap": "round", "line-join": "round" },
    });
  }

  if (!map.getLayer(GUIDANCE_PATH_LAYER_ID)) {
    map.addLayer({
      id: GUIDANCE_PATH_LAYER_ID,
      type: "line",
      source: GUIDANCE_PATH_SOURCE_ID,
      paint: {
        "line-color": MAP_COLORS.maneuver,
        "line-width": ["interpolate", ["linear"], ["zoom"], 14, 2.4, 19, 5.5],
        "line-opacity": 0.55,
      },
      layout: { "line-cap": "round", "line-join": "round" },
    });
  }

  ensureChevronLayer(map);

  if (map.getLayer(GUIDANCE_PATH_GLOW_ID)) {
    map.setPaintProperty(
      GUIDANCE_PATH_GLOW_ID,
      "line-opacity",
      show ? 0.12 + intensity * 0.16 : 0,
    );
  }
  if (map.getLayer(GUIDANCE_PATH_LAYER_ID)) {
    map.setPaintProperty(
      GUIDANCE_PATH_LAYER_ID,
      "line-opacity",
      show ? 0.28 + intensity * 0.32 : 0,
    );
  }

  for (const id of ["demo-route-glow", "demo-route-line", "demo-route-maneuver"]) {
    if (map.getLayer(id)) map.moveLayer(id);
  }
  for (const id of [GUIDANCE_PATH_GLOW_ID, GUIDANCE_PATH_LAYER_ID, GUIDANCE_LAYER_ID]) {
    if (map.getLayer(id)) map.moveLayer(id);
  }
}

export function clearGuidanceArrows(map: MapLibreMap) {
  const path = map.getSource(GUIDANCE_PATH_SOURCE_ID);
  if (path?.type === "geojson") (path as GeoJSONSource).setData(emptyLine());
  const arrows = map.getSource(GUIDANCE_SOURCE_ID);
  if (arrows?.type === "geojson") (arrows as GeoJSONSource).setData(emptyCollection());
}
