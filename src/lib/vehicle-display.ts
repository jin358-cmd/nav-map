import {
  damp,
  destinationPoint,
  distanceKm,
  headingDelta,
  lerp,
  lerpAngle,
} from "@/lib/geo";
import { pointAtRouteMeters, type RouteProgressModel } from "@/lib/route-progress";
import type { DisplayPose, VehiclePose } from "@/types/domain";

export type VehicleDisplayState = {
  lng: number;
  lat: number;
  heading: number;
  predictedMeters: number;
  holdLng: number;
  holdLat: number;
};

const HOLD_SPEED_MPS = 0.45;
const HOLD_METERS = 4.5;
const TELEPORT_METERS = 90;

export function createVehicleDisplayState(
  pose: Pick<VehiclePose, "lng" | "lat" | "heading">,
): VehicleDisplayState {
  return {
    lng: pose.lng,
    lat: pose.lat,
    heading: pose.heading,
    predictedMeters: 0,
    holdLng: pose.lng,
    holdLat: pose.lat,
  };
}

/** Camera follow: fast response + light smoothing. Seconds, not animation duration. */
export function presentationFollowTau(speedMps: number, approachBlend: number) {
  const kmh = speedMps * 3.6;
  let posTau = 0.08;
  if (kmh >= 90) posTau = 0.048;
  else if (kmh >= 55) posTau = 0.055;
  else if (kmh >= 25) posTau = 0.065;
  else if (kmh >= 8) posTau = 0.075;
  else posTau = 0.1;
  return {
    posTau,
    zoomTau: approachBlend > 0.02 ? 0.09 : posTau,
    bearingTau: kmh < 8 ? 0.62 : kmh < 25 ? 0.32 : Math.min(posTau, 0.16),
    bearingHoldDeg: kmh < 8 ? 5 : kmh < 25 ? 3.2 : 1.8,
  };
}

function glideHeading(current: number, desired: number, dtSeconds: number) {
  const jump = headingDelta(current, desired);
  if (jump < 0.6) return desired;
  return lerpAngle(current, desired, damp(dtSeconds, jump > 40 ? 0.05 : 0.07));
}

function travelSpeed(
  raw: VehiclePose,
  target: DisplayPose | VehiclePose,
  current: VehicleDisplayState,
  elapsedSinceFixSeconds: number,
) {
  const reported = Math.max(0, raw.speedMps ?? 0);
  if (reported >= HOLD_SPEED_MPS) return reported;
  const gpsMeters = "routeMeters" in target ? target.routeMeters : null;
  const behindGps = gpsMeters == null || gpsMeters + 0.5 >= current.predictedMeters;
  if (!behindGps || elapsedSinceFixSeconds <= 0.05 || elapsedSinceFixSeconds > 1.3) {
    return reported;
  }
  const jump = distanceKm(current, target) * 1000;
  if (jump < 8) return reported;
  const implied = jump / elapsedSinceFixSeconds;
  if (implied >= 0.8 && implied <= 42) return implied;
  return reported;
}

/**
 * Presentation pose. Raw GPS and route progress are not written back.
 * Between fixes the marker keeps moving at road speed so it does not hop.
 */
export function stepVehicleDisplay({
  current,
  target,
  raw,
  model,
  navigating,
  dtSeconds,
  elapsedSinceFixSeconds,
}: {
  current: VehicleDisplayState;
  target: DisplayPose | VehiclePose;
  raw: VehiclePose;
  model: RouteProgressModel | null;
  navigating: boolean;
  dtSeconds: number;
  elapsedSinceFixSeconds: number;
}): VehicleDisplayState {
  const dt = Math.min(0.05, Math.max(0, dtSeconds));
  const elapsed = Math.max(0, elapsedSinceFixSeconds);
  const speed = travelSpeed(raw, target, current, elapsed);
  const incoming = { lng: target.lng, lat: target.lat };
  const jump = distanceKm(current, incoming) * 1000;

  if (jump > TELEPORT_METERS) {
    const meters = "routeMeters" in target ? target.routeMeters : 0;
    return {
      lng: incoming.lng,
      lat: incoming.lat,
      heading: target.heading,
      predictedMeters: meters,
      holdLng: incoming.lng,
      holdLat: incoming.lat,
    };
  }

  if (speed < HOLD_SPEED_MPS && jump < HOLD_METERS) {
    return {
      ...current,
      heading: glideHeading(current.heading, target.heading, dt),
      holdLng: current.lng,
      holdLat: current.lat,
    };
  }

  const snapped = "snapped" in target ? target.snapped : false;
  const confidence = "snapConfidence" in target ? target.snapConfidence : 0;
  if (
    navigating &&
    snapped &&
    confidence >= 0.35 &&
    model &&
    "routeMeters" in target
  ) {
    const gpsMeters = Math.max(0, target.routeMeters);
    let along = current.predictedMeters;
    if ((along <= 0 && gpsMeters > 1) || Math.abs(along - gpsMeters) > 70) {
      along = gpsMeters;
    }
    along += speed * dt;
    const lead = Math.min(34, Math.max(3, speed * 1.15));
    if (along > gpsMeters + lead) along = gpsMeters + lead;
    if (along < gpsMeters) {
      const gap = gpsMeters - along;
      along += Math.min(gap, Math.max(speed * dt, gap * damp(dt, 0.035)));
    }
    along = Math.max(0, Math.min(model.totalMeters, along));
    const placed = pointAtRouteMeters(model, along);
    if (placed) {
      return {
        lng: placed.point.lng,
        lat: placed.point.lat,
        heading: glideHeading(current.heading, placed.heading, dt),
        predictedMeters: along,
        holdLng: placed.point.lng,
        holdLat: placed.point.lat,
      };
    }
  }

  const coastMeters = Math.min(40, speed * Math.min(elapsed, 1.15));
  const goal =
    speed >= HOLD_SPEED_MPS
      ? destinationPoint(incoming, coastMeters, target.heading || current.heading)
      : incoming;
  const gap = distanceKm(current, goal) * 1000;
  const step =
    gap < 0.05
      ? gap
      : Math.min(gap, Math.max(speed * dt, gap * damp(dt, 0.04)));
  const t = gap <= 0.05 ? 1 : step / gap;
  const lng = lerp(current.lng, goal.lng, t);
  const lat = lerp(current.lat, goal.lat, t);
  return {
    lng,
    lat,
    heading: glideHeading(current.heading, target.heading, dt),
    predictedMeters: 0,
    holdLng: lng,
    holdLat: lat,
  };
}
