import type { GeoJSONSource, Map as MapLibreMap } from "maplibre-gl";
import {
  approachLookaheadMeters,
  guidanceArrowsAlong,
  sliceRouteAhead,
} from "@/lib/upcoming-route";

export const GUIDANCE_SOURCE_ID = "guidance-arrows";
export const GUIDANCE_PATH_SOURCE_ID = "guidance-path";
export const GUIDANCE_LAYER_ID = "guidance-arrows-layer";
export const GUIDANCE_PATH_LAYER_ID = "guidance-path-layer";
export const GUIDANCE_PATH_GLOW_ID = "guidance-path-glow";
const CHEVRON_IMAGE_ID = "guidance-chevron";

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
  const size = 96;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  ctx.clearRect(0, 0, size, size);
  ctx.translate(size / 2, size / 2);

  const draw = (
    offsetY: number,
    fill: string,
    stroke: string,
    lineWidth: number,
  ) => {
    ctx.beginPath();
    ctx.moveTo(0, -34 + offsetY);
    ctx.lineTo(28, 10 + offsetY);
    ctx.lineTo(14, 10 + offsetY);
    ctx.lineTo(0, -6 + offsetY);
    ctx.lineTo(-14, 10 + offsetY);
    ctx.lineTo(-28, 10 + offsetY);
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.strokeStyle = stroke;
    ctx.lineWidth = lineWidth;
    ctx.lineJoin = "round";
    ctx.stroke();
  };

  draw(7, "rgba(161, 98, 7, 0.55)", "rgba(120, 53, 15, 0.35)", 2);
  draw(0, "#facc15", "#fef08a", 3);
  ctx.beginPath();
  ctx.moveTo(0, -28);
  ctx.lineTo(10, -8);
  ctx.lineTo(0, -14);
  ctx.lineTo(-10, -8);
  ctx.closePath();
  ctx.fillStyle = "rgba(254, 249, 195, 0.85)";
  ctx.fill();

  return ctx.getImageData(0, 0, size, size);
}

function ensureImages(map: MapLibreMap) {
  if (map.hasImage(CHEVRON_IMAGE_ID)) return;
  const image = createChevronImage();
  if (!image) return;
  map.addImage(CHEVRON_IMAGE_ID, image, { pixelRatio: 2 });
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

  const ahead = navigating
    ? sliceRouteAhead(route, routeMeters, approachLookaheadMeters(distanceToNext))
    : [];
  const arrows = navigating
    ? guidanceArrowsAlong(ahead, 16, phase)
    : [];

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
        "line-width": ["interpolate", ["linear"], ["zoom"], 14, 10, 19, 28],
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
        "line-width": ["interpolate", ["linear"], ["zoom"], 14, 4.5, 19, 12],
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
        "icon-image": CHEVRON_IMAGE_ID,
        "icon-size": ["interpolate", ["linear"], ["zoom"], 15, 0.42, 19, 0.95],
        "icon-rotate": ["get", "bearing"],
        "icon-rotation-alignment": "map",
        "icon-pitch-alignment": "map",
        "icon-allow-overlap": true,
        "icon-ignore-placement": true,
      },
      paint: {
        "icon-opacity": ["get", "opacity"],
        "icon-halo-color": "#fef08a",
        "icon-halo-width": 1.2,
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
