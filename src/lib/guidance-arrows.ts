import type {
  ExpressionSpecification,
  GeoJSONSource,
  Map as MapLibreMap,
} from "maplibre-gl";
import type { CameraMode } from "@/types/domain";
import {
  guidanceBowSigns,
  shouldShowGuidanceSigns,
} from "@/lib/upcoming-route";

export const GUIDANCE_SOURCE_ID = "navpilot-bow-signs";
export const GUIDANCE_LAYER_ID = "navpilot-bow-signs-layer";
const BOW_STRAIGHT_ID = "navpilot-bow-sign-v1-straight";
const BOW_LEFT_ID = "navpilot-bow-sign-v1-left";
const BOW_RIGHT_ID = "navpilot-bow-sign-v1-right";

let showing = false;

function emptyCollection() {
  return { type: "FeatureCollection" as const, features: [] };
}

function fillPath(
  ctx: CanvasRenderingContext2D,
  draw: () => void,
  fill: string | CanvasGradient,
  stroke?: string,
  lineWidth = 5,
) {
  ctx.beginPath();
  draw();
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

function bowFront(ctx: CanvasRenderingContext2D, kind: "straight" | "left" | "right") {
  if (kind === "straight") {
    ctx.moveTo(0, -112);
    ctx.quadraticCurveTo(92, 4, 78, 20);
    ctx.lineTo(30, 20);
    ctx.lineTo(30, 82);
    ctx.lineTo(-30, 82);
    ctx.lineTo(-30, 20);
    ctx.lineTo(-78, 20);
    ctx.quadraticCurveTo(-92, 4, 0, -112);
    return;
  }
  if (kind === "left") {
    ctx.moveTo(32, 90);
    ctx.lineTo(6, 90);
    ctx.lineTo(6, 8);
    ctx.quadraticCurveTo(6, -52, -42, -62);
    ctx.lineTo(-24, -28);
    ctx.lineTo(-98, -46);
    ctx.lineTo(-52, -112);
    ctx.lineTo(-40, -76);
    ctx.quadraticCurveTo(52, -70, 32, 6);
    return;
  }
  ctx.moveTo(-32, 90);
  ctx.lineTo(-6, 90);
  ctx.lineTo(-6, 8);
  ctx.quadraticCurveTo(-6, -52, 42, -62);
  ctx.lineTo(24, -28);
  ctx.lineTo(98, -46);
  ctx.lineTo(52, -112);
  ctx.lineTo(40, -76);
  ctx.quadraticCurveTo(-52, -70, -32, 6);
}

function createBowSignImage(kind: "straight" | "left" | "right") {
  const size = 256;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  ctx.clearRect(0, 0, size, size);
  ctx.translate(size / 2, size / 2 + 8);

  ctx.save();
  ctx.fillStyle = "rgba(8, 47, 73, 0.34)";
  ctx.beginPath();
  ctx.ellipse(10, 96, 54, 14, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  ctx.save();
  ctx.translate(16, 18);
  fillPath(ctx, () => bowFront(ctx, kind), "#0f766e");
  ctx.restore();

  fillPath(ctx, () => bowFront(ctx, kind), "#22d3ee", "#ecfeff", 6);

  const sheen = ctx.createLinearGradient(-24, -118, 36, 86);
  sheen.addColorStop(0, "rgba(255, 255, 255, 0.5)");
  sheen.addColorStop(0.42, "rgba(165, 243, 252, 0.16)");
  sheen.addColorStop(1, "rgba(8, 145, 178, 0.1)");
  fillPath(ctx, () => bowFront(ctx, kind), sheen);

  fillPath(
    ctx,
    () => {
      if (kind === "straight") {
        ctx.moveTo(0, -82);
        ctx.quadraticCurveTo(38, 4, 32, 14);
        ctx.lineTo(12, 14);
        ctx.lineTo(12, 52);
        ctx.lineTo(-12, 52);
        ctx.lineTo(-12, 14);
        ctx.lineTo(-32, 14);
        ctx.quadraticCurveTo(-38, 4, 0, -82);
        return;
      }
      if (kind === "left") {
        ctx.moveTo(18, 62);
        ctx.lineTo(14, 62);
        ctx.lineTo(14, 8);
        ctx.quadraticCurveTo(14, -28, -18, -36);
        ctx.lineTo(-8, -16);
        ctx.lineTo(-58, -28);
        ctx.lineTo(-30, -70);
        ctx.lineTo(-22, -46);
        ctx.quadraticCurveTo(28, -40, 18, 4);
        return;
      }
      ctx.moveTo(-18, 62);
      ctx.lineTo(-14, 62);
      ctx.lineTo(-14, 8);
      ctx.quadraticCurveTo(-14, -28, 18, -36);
      ctx.lineTo(8, -16);
      ctx.lineTo(58, -28);
      ctx.lineTo(30, -70);
      ctx.lineTo(22, -46);
      ctx.quadraticCurveTo(-28, -40, -18, 4);
    },
    "rgba(236, 254, 255, 0.9)",
  );

  ctx.beginPath();
  if (kind === "straight") {
    ctx.moveTo(0, -100);
    ctx.lineTo(10, -36);
  } else if (kind === "left") {
    ctx.moveTo(-44, -96);
    ctx.lineTo(-12, -40);
  } else {
    ctx.moveTo(44, -96);
    ctx.lineTo(12, -40);
  }
  ctx.strokeStyle = "rgba(255, 255, 255, 0.7)";
  ctx.lineWidth = 5;
  ctx.lineCap = "round";
  ctx.stroke();

  return ctx.getImageData(0, 0, size, size);
}

function ensureImages(map: MapLibreMap) {
  const images: Array<["straight" | "left" | "right", string]> = [
    ["straight", BOW_STRAIGHT_ID],
    ["left", BOW_LEFT_ID],
    ["right", BOW_RIGHT_ID],
  ];
  for (const [kind, id] of images) {
    if (map.hasImage(id)) continue;
    const image = createBowSignImage(kind);
    if (image) map.addImage(id, image, { pixelRatio: 2 });
  }
}

function bowImage(): ExpressionSpecification {
  return [
    "match",
    ["get", "kind"],
    "left",
    BOW_LEFT_ID,
    "right",
    BOW_RIGHT_ID,
    BOW_STRAIGHT_ID,
  ];
}

function bowSize(): ExpressionSpecification {
  return [
    "interpolate",
    ["linear"],
    ["zoom"],
    14.2,
    ["*", ["get", "scale"], 0.92],
    16.2,
    ["*", ["get", "scale"], 1.28],
    17.4,
    ["*", ["get", "scale"], 1.52],
    18.4,
    ["*", ["get", "scale"], 1.72],
  ];
}

function ensureBowLayer(map: MapLibreMap, cameraMode: CameraMode = "3d") {
  const size = bowSize();
  const image = bowImage();
  const offset: [number, number] = cameraMode === "3d" ? [0, -44] : [0, -16];
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
        "icon-halo-color": "#a5f3fc",
        "icon-halo-width": 0.35,
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

function stackGuidanceLayers(map: MapLibreMap) {
  for (const id of ["demo-route-glow", "demo-route-line", "demo-route-maneuver"]) {
    if (map.getLayer(id)) map.moveLayer(id);
  }
  if (map.getLayer(GUIDANCE_LAYER_ID)) map.moveLayer(GUIDANCE_LAYER_ID);
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

  const live =
    navigating &&
    options.isTurn === true &&
    shouldShowGuidanceSigns(distanceToNext, showing);
  showing = live;

  const visible =
    live && route.length >= 2
      ? guidanceBowSigns({
          route,
          routeMeters,
          distanceToNext,
          cueMeters: options.cueMeters,
        })
      : [];

  const data = {
    type: "FeatureCollection" as const,
    features: visible.map((sign, index) => ({
      type: "Feature" as const,
      id: index,
      properties: {
        bearing: sign.bearing,
        opacity: sign.opacity,
        kind: sign.kind,
        scale:
          sign.role === "hero"
            ? sign.scale * (1 + 0.035 * Math.sin(phase * Math.PI * 2))
            : sign.scale,
        role: sign.role,
      },
      geometry: {
        type: "Point" as const,
        coordinates: [sign.lng, sign.lat],
      },
    })),
  };

  const source = map.getSource(GUIDANCE_SOURCE_ID);
  if (source?.type === "geojson") {
    (source as GeoJSONSource).setData(data);
  } else if (!source) {
    map.addSource(GUIDANCE_SOURCE_ID, { type: "geojson", data });
  }

  ensureBowLayer(map, options.cameraMode ?? "3d");
  stackGuidanceLayers(map);
}

export function resetGuidanceArrowCache() {
  showing = false;
}

export function clearGuidanceArrows(map: MapLibreMap) {
  resetGuidanceArrowCache();
  const source = map.getSource(GUIDANCE_SOURCE_ID);
  if (source?.type === "geojson") {
    (source as GeoJSONSource).setData(emptyCollection());
  }
}
