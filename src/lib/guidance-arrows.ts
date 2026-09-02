import type {
  ExpressionSpecification,
  GeoJSONSource,
  Map as MapLibreMap,
} from "maplibre-gl";
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
const ARROW_IMAGE_ID = "guidance-hover-arrow-3d-v2";

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

function drawPolygon(
  ctx: CanvasRenderingContext2D,
  points: [number, number][],
  fill: string,
  stroke?: string,
  lineWidth = 3,
) {
  ctx.beginPath();
  ctx.moveTo(points[0][0], points[0][1]);
  for (const point of points.slice(1)) ctx.lineTo(point[0], point[1]);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = lineWidth;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.stroke();
  }
}

function createHoverArrowImage() {
  const size = 256;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  ctx.clearRect(0, 0, size, size);
  ctx.translate(size / 2, size / 2);

  ctx.save();
  ctx.fillStyle = "rgba(120, 53, 15, 0.32)";
  ctx.beginPath();
  ctx.ellipse(8, 98, 46, 12, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  const depth: [number, number] = [14, 16];
  const front: [number, number][] = [
    [0, -92],
    [78, 18],
    [32, 18],
    [32, 58],
    [-32, 58],
    [-32, 18],
    [-78, 18],
  ];
  const back = front.map(([x, y]) => [x + depth[0], y + depth[1]] as [number, number]);

  drawPolygon(ctx, [
    back[0],
    back[1],
    front[1],
    front[0],
  ], "#92400e");
  drawPolygon(ctx, [
    back[1],
    back[2],
    front[2],
    front[1],
  ], "#a16207");
  drawPolygon(ctx, [
    back[2],
    back[3],
    front[3],
    front[2],
  ], "#854d0e");
  drawPolygon(ctx, [
    back[3],
    back[4],
    front[4],
    front[3],
  ], "#713f12");
  drawPolygon(ctx, [
    back[0],
    back[6],
    front[6],
    front[0],
  ], "#ca8a04");

  drawPolygon(ctx, front, "#facc15", "#fff7c2", 5);

  drawPolygon(
    ctx,
    [
      [0, -70],
      [28, -2],
      [12, -2],
      [12, 38],
      [-12, 38],
      [-12, -2],
      [-28, -2],
    ],
    "rgba(254, 249, 195, 0.92)",
  );

  ctx.beginPath();
  ctx.moveTo(0, -88);
  ctx.lineTo(14, -28);
  ctx.strokeStyle = "rgba(255, 255, 255, 0.55)";
  ctx.lineWidth = 4;
  ctx.lineCap = "round";
  ctx.stroke();

  return ctx.getImageData(0, 0, size, size);
}

function ensureImages(map: MapLibreMap) {
  if (map.hasImage(ARROW_IMAGE_ID)) return;
  const image = createHoverArrowImage();
  if (!image) return;
  map.addImage(ARROW_IMAGE_ID, image, { pixelRatio: 2 });
}

function ensureArrowLayer(map: MapLibreMap) {
  const size = [
    "interpolate",
    ["linear"],
    ["zoom"],
    14,
    1.35,
    17,
    2.05,
    19,
    2.7,
  ] as ExpressionSpecification;

  if (!map.getLayer(GUIDANCE_LAYER_ID)) {
    map.addLayer({
      id: GUIDANCE_LAYER_ID,
      type: "symbol",
      source: GUIDANCE_SOURCE_ID,
      layout: {
        "icon-image": ARROW_IMAGE_ID,
        "icon-size": size,
        "icon-anchor": "bottom",
        "icon-offset": [0, -18],
        "icon-rotate": ["get", "bearing"],
        "icon-rotation-alignment": "map",
        "icon-pitch-alignment": "viewport",
        "icon-allow-overlap": true,
        "icon-ignore-placement": true,
      },
      paint: {
        "icon-opacity": ["get", "opacity"],
        "icon-halo-color": "#fef08a",
        "icon-halo-width": 2,
      },
    });
    return;
  }

  map.setLayoutProperty(GUIDANCE_LAYER_ID, "icon-image", ARROW_IMAGE_ID);
  map.setLayoutProperty(GUIDANCE_LAYER_ID, "icon-size", size);
  map.setLayoutProperty(GUIDANCE_LAYER_ID, "icon-anchor", "bottom");
  map.setLayoutProperty(GUIDANCE_LAYER_ID, "icon-offset", [0, -18]);
  map.setLayoutProperty(GUIDANCE_LAYER_ID, "icon-pitch-alignment", "viewport");
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
  const arrows = show ? guidanceArrowsAlong(ahead, 22, phase) : [];

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
        opacity: 0.55 + arrow.opacity * 0.45,
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

  ensureArrowLayer(map);

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
