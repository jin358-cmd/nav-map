import { damp, distanceKm, lerp, lerpAngle } from "@/lib/geo";
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

const MAX_PREDICT_METERS = 16;
const STATIONARY_SPEED_MPS = 0.45;
const STATIONARY_HOLD_METERS = 2;

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
    zoomTau: approachBlend > 0.02 ? 0.07 : posTau,
    bearingTau: kmh < 6 ? 0.12 : Math.min(posTau, 0.07),
  };
}

function positionTau(speedMps: number, jumpMeters: number) {
  const kmh = speedMps * 3.6;
  if (jumpMeters > 28 || kmh >= 90) return 0.05;
  if (kmh >= 55) return 0.055;
  if (kmh >= 25) return 0.065;
  if (kmh >= 8) return 0.08;
  return 0.11;
}

function headingTau(speedMps: number) {
  if (speedMps < 0.8) return 0.13;
  if (speedMps < 4) return 0.09;
  return 0.06;
}

function isNoisyFix(accuracy: number | undefined, jumpMeters: number, speedMps: number) {
  if (accuracy == null || accuracy <= 24) return false;
  return jumpMeters < Math.min(accuracy * 0.6, 20) && speedMps < 3;
}

/**
 * Presentation-only interpolation. GPS / snap / route progress stay on Raw GPS.
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
  const snapped = "snapped" in target ? target.snapped : false;
  const confidence = "snapConfidence" in target ? target.snapConfidence : 0;
  const speedMps = raw.speedMps ?? 0;
  const here = { lng: current.lng, lat: current.lat };
  const incoming = { lng: target.lng, lat: target.lat };
  const incomingJump = distanceKm(here, incoming) * 1000;
  const noisy = isNoisyFix(raw.accuracy, incomingJump, speedMps);
  const goal = noisy
    ? { lng: current.holdLng, lat: current.holdLat }
    : incoming;
  const jumpMeters = distanceKm(here, goal) * 1000;
  const stationary =
    speedMps < STATIONARY_SPEED_MPS && jumpMeters < STATIONARY_HOLD_METERS;

  if (stationary) {
    return {
      ...current,
      heading: lerpAngle(current.heading, target.heading, damp(dtSeconds, 0.14)),
      predictedMeters: 0,
      holdLng: noisy ? current.holdLng : goal.lng,
      holdLat: noisy ? current.holdLat : goal.lat,
    };
  }

  let desired = goal;
  let desiredHeading = target.heading;
  let predictedMeters = current.predictedMeters;

  if (
    navigating &&
    snapped &&
    confidence >= 0.48 &&
    model &&
    speedMps > 1 &&
    "routeMeters" in target
  ) {
    predictedMeters = Math.min(
      MAX_PREDICT_METERS,
      Math.max(current.predictedMeters, speedMps * elapsedSinceFixSeconds),
    );
    const along = pointAtRouteMeters(model, target.routeMeters + predictedMeters);
    if (along) {
      const drift = distanceKm(raw, along.point) * 1000;
      if (drift <= 40) {
        desired = along.point;
        desiredHeading = along.heading;
      }
    }
  } else {
    predictedMeters = 0;
  }

  const holdLng = noisy ? current.holdLng : desired.lng;
  const holdLat = noisy ? current.holdLat : desired.lat;

  if (jumpMeters > 80) {
    return {
      lng: desired.lng,
      lat: desired.lat,
      heading: desiredHeading,
      predictedMeters: 0,
      holdLng,
      holdLat,
    };
  }

  const posT = damp(dtSeconds, positionTau(speedMps, jumpMeters));
  const headT = damp(dtSeconds, headingTau(speedMps));

  return {
    lng: lerp(current.lng, desired.lng, posT),
    lat: lerp(current.lat, desired.lat, posT),
    heading: lerpAngle(current.heading, desiredHeading, headT),
    predictedMeters,
    holdLng,
    holdLat,
  };
}
