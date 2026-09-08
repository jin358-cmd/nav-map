import type { GeoJSONSource, Map as MapLibreMap } from "maplibre-gl";
import { damp, destinationPoint, headingDelta, lerpAngle } from "@/lib/geo";
import type { LngLat, VehiclePose } from "@/types/domain";

export const HEADING_CONE_SOURCE = "np-heading-cone";
export const HEADING_CONE_FILL = "np-heading-cone-fill";
export const HEADING_CONE_EDGE = "np-heading-cone-edge";

/** Google Maps–like fan: ~66° total, not a 120° sweep. */
const HALF_ANGLE_DEG = 33;
const ARC_STEPS = 22;
const STILL_HEADING_HOLD_DEG = 22;
const STILL_HEADING_TAU = 0.55;
const MOVE_HEADING_HOLD_DEG = 1.4;
const MOVE_HEADING_TAU = 0.08;
const COMPASS_SPEED_MPS = 2.2;

export function stepConeHeading(
  current: number,
  target: number,
  dtSeconds: number,
  speedMps = 0,
) {
  const moving = speedMps >= COMPASS_SPEED_MPS;
  const jump = headingDelta(current, target);
  if (moving) {
    if (jump < MOVE_HEADING_HOLD_DEG) return current;
    const tau = jump > 28 ? 0.04 : MOVE_HEADING_TAU;
    return lerpAngle(current, target, damp(dtSeconds, tau));
  }
  if (jump < STILL_HEADING_HOLD_DEG) return current;
  const tau = jump > 50 ? 0.12 : STILL_HEADING_TAU;
  return lerpAngle(current, target, damp(dtSeconds, tau));
}

export function coneRadiusMeters(zoom: number) {
  const t = (Math.max(13, Math.min(17, zoom)) - 14) / 3;
  return 70 + t * 50;
}

export function coneHeadingTarget({
  gpsHeading,
  headingAvailable,
  compassHeading,
  speedMps,
  fallbackHeading,
}: {
  gpsHeading: number;
  headingAvailable?: boolean;
  compassHeading: number | null;
  speedMps?: number;
  fallbackHeading: number;
}) {
  const moving = (speedMps ?? 0) >= COMPASS_SPEED_MPS;
  if (!moving && compassHeading != null) return compassHeading;
  if (headingAvailable) return gpsHeading;
  if (compassHeading != null) return compassHeading;
  return fallbackHeading;
}

function firstLabelLayerId(map: MapLibreMap): string | undefined {
  const layers = map.getStyle()?.layers ?? [];
  return layers.find((layer) => layer.type === "symbol")?.id;
}

export function shouldShowHeadingCone({
  navigating,
  rerouting,
  source,
  headingAvailable,
  compassAvailable,
}: {
  navigating: boolean;
  rerouting: boolean;
  source: VehiclePose["source"];
  headingAvailable?: boolean;
  compassAvailable?: boolean;
}) {
  return (
    !navigating &&
    !rerouting &&
    source === "gps" &&
    (headingAvailable === true || compassAvailable === true)
  );
}

export function headingConePolygon(
  center: LngLat,
  headingDeg: number,
  radiusMeters = 92,
) {
  const start = headingDeg - HALF_ANGLE_DEG;
  const ring: [number, number][] = [[center.lng, center.lat]];
  for (let i = 0; i <= ARC_STEPS; i += 1) {
    const bearing = start + (i / ARC_STEPS) * HALF_ANGLE_DEG * 2;
    const tip = destinationPoint(center, radiusMeters, bearing);
    ring.push([tip.lng, tip.lat]);
  }
  ring.push([center.lng, center.lat]);
  return {
    type: "Feature" as const,
    properties: {},
    geometry: {
      type: "Polygon" as const,
      coordinates: [ring],
    },
  };
}

export function ensureHeadingConeLayers(map: MapLibreMap): void {
  if (!map.getSource(HEADING_CONE_SOURCE)) {
    map.addSource(HEADING_CONE_SOURCE, {
      type: "geojson",
      data: { type: "FeatureCollection", features: [] },
    });
  }
  const beforeId = firstLabelLayerId(map);
  if (!map.getLayer(HEADING_CONE_FILL)) {
    map.addLayer(
      {
        id: HEADING_CONE_FILL,
        type: "fill",
        source: HEADING_CONE_SOURCE,
        paint: {
          "fill-color": "#3B82F6",
          "fill-opacity": 0.26,
          "fill-antialias": true,
        },
      },
      beforeId,
    );
  }
  if (!map.getLayer(HEADING_CONE_EDGE)) {
    map.addLayer(
      {
        id: HEADING_CONE_EDGE,
        type: "line",
        source: HEADING_CONE_SOURCE,
        paint: {
          "line-color": "#60A5FA",
          "line-width": 10,
          "line-opacity": 0.2,
          "line-blur": 7,
        },
      },
      beforeId,
    );
  }
}

export function upsertHeadingCone(
  map: MapLibreMap,
  center: LngLat | null,
  headingDeg: number,
  visible: boolean,
  zoom = 16,
): void {
  const source = map.getSource(HEADING_CONE_SOURCE);
  if (!source || source.type !== "geojson") return;
  const geo = source as GeoJSONSource;
  if (!visible || !center) {
    geo.setData({ type: "FeatureCollection", features: [] });
    return;
  }
  geo.setData({
    type: "FeatureCollection",
    features: [headingConePolygon(center, headingDeg, coneRadiusMeters(zoom))],
  });
}
