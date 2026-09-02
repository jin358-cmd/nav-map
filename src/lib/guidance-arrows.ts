import type { GeoJSONSource, Map as MapLibreMap } from "maplibre-gl";
import {
  approachLookaheadMeters,
  guidanceArrowsAlong,
  shouldShowGuidanceArrows,
  sliceRouteAhead,
} from "@/lib/upcoming-route";

export const GUIDANCE_SOURCE_ID = "guidance-arrows";
export const GUIDANCE_PATH_SOURCE_ID = "guidance-path";
export const GUIDANCE_LAYER_ID = "guidance-arrows-layer";
export const GUIDANCE_PATH_LAYER_ID = "guidance-path-layer";
export const GUIDANCE_PATH_GLOW_ID = "guidance-path-glow";
const SIGN_IMAGE_ID = "guidance-signboard-3d-v1";

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

function createDirectionSignImage() {
  const size = 192;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  ctx.clearRect(0, 0, size, size);
  ctx.translate(size / 2, size / 2);

  ctx.save();
  ctx.fillStyle = "rgba(120, 53, 15, 0.28)";
  ctx.beginPath();
  ctx.ellipse(0, 78, 34, 10, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  ctx.save();
  ctx.fillStyle = "#3f3f46";
  ctx.fillRect(-5, 46, 10, 34);
  ctx.fillStyle = "#71717a";
  ctx.fillRect(-3.5, 46, 7, 34);
  ctx.restore();

  const drawBoard = (
    offsetX: number,
    offsetY: number,
    fill: string,
    stroke: string,
    lineWidth: number,
  ) => {
    ctx.beginPath();
    ctx.moveTo(offsetX, -78 + offsetY);
    ctx.lineTo(58 + offsetX, 8 + offsetY);
    ctx.lineTo(26 + offsetX, 8 + offsetY);
    ctx.lineTo(26 + offsetX, 44 + offsetY);
    ctx.lineTo(-26 + offsetX, 44 + offsetY);
    ctx.lineTo(-26 + offsetX, 8 + offsetY);
    ctx.lineTo(-58 + offsetX, 8 + offsetY);
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.strokeStyle = stroke;
    ctx.lineWidth = lineWidth;
    ctx.lineJoin = "round";
    ctx.stroke();
  };

  drawBoard(6, 8, "rgba(69, 26, 3, 0.55)", "rgba(41, 16, 5, 0.4)", 3);
  drawBoard(0, 0, "#facc15", "#fef08a", 4);

  ctx.beginPath();
  ctx.moveTo(0, -66);
  ctx.lineTo(18, -10);
  ctx.lineTo(8, -10);
  ctx.lineTo(8, 30);
  ctx.lineTo(-8, 30);
  ctx.lineTo(-8, -10);
  ctx.lineTo(-18, -10);
  ctx.closePath();
  ctx.fillStyle = "rgba(254, 249, 195, 0.92)";
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(-22, 8);
  ctx.lineTo(-22, 40);
  ctx.lineTo(22, 40);
  ctx.strokeStyle = "rgba(161, 98, 7, 0.45)";
  ctx.lineWidth = 2;
  ctx.stroke();

  return ctx.getImageData(0, 0, size, size);
}

function ensureImages(map: MapLibreMap) {
  if (map.hasImage(SIGN_IMAGE_ID)) return;
  const image = createDirectionSignImage();
  if (!image) return;
  map.addImage(SIGN_IMAGE_ID, image, { pixelRatio: 2 });
}

export function upsertGuidanceArrows(
  map: MapLibreMap,
  route: [number, number][],
  routeMeters: number,
  distanceToNext: number,
  navigating: boolean,
  phase: number,
) {
  ensureImages(map);

  const show = navigating && shouldShowGuidanceArrows(distanceToNext);
  const ahead = show
    ? sliceRouteAhead(route, routeMeters, approachLookaheadMeters(distanceToNext))
    : [];
  const arrows = show ? guidanceArrowsAlong(ahead, 16, phase) : [];

  const pathData = ahead.length >= 2
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
        "line-color": "#fde047",
        "line-width": ["interpolate", ["linear"], ["zoom"], 14, 7, 19, 18],
        "line-opacity": 0.22,
        "line-blur": 8,
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
        "line-color": "#facc15",
        "line-width": ["interpolate", ["linear"], ["zoom"], 14, 3.2, 19, 8],
        "line-opacity": 0.9,
      },
      layout: { "line-cap": "round", "line-join": "round" },
    });
  }

  if (!map.getLayer(GUIDANCE_LAYER_ID)) {
    map.addLayer({
      id: GUIDANCE_LAYER_ID,
      type: "symbol",
      source: GUIDANCE_SOURCE_ID,
      layout: {
        "icon-image": SIGN_IMAGE_ID,
        "icon-size": ["interpolate", ["linear"], ["zoom"], 15, 0.72, 19, 1.35],
        "icon-rotate": ["get", "bearing"],
        "icon-rotation-alignment": "map",
        "icon-pitch-alignment": "viewport",
        "icon-allow-overlap": true,
        "icon-ignore-placement": true,
      },
      paint: {
        "icon-opacity": ["get", "opacity"],
        "icon-halo-color": "#fef08a",
        "icon-halo-width": 1.4,
      },
    });
  }

  for (const id of ["demo-route-glow", "demo-route-line"]) {
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
