import { damp, distanceKm, lerp, lerpAngle } from "@/lib/geo";
import { pointAtRouteMeters, type RouteProgressModel } from "@/lib/route-progress";
import type { DisplayPose, VehiclePose } from "@/types/domain";

export type VehicleDisplayState = {
  lng: number;
  lat: number;
  heading: number;
  predictedMeters: number;
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
  };
}

/**
 * 將畫面箭頭平順移向目標。GPS 更新只改目標，不重開動畫。
 * 吸附成功時可沿路線做很短的速度預測，新 GPS 到達後會立刻往回校正。
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
  const goal = { lng: target.lng, lat: target.lat };
  const jumpMeters = distanceKm(here, goal) * 1000;
  const stationary =
    speedMps < STATIONARY_SPEED_MPS && jumpMeters < STATIONARY_HOLD_METERS;

  if (stationary) {
    return {
      ...current,
      heading: lerpAngle(current.heading, target.heading, damp(dtSeconds, 0.45)),
      predictedMeters: 0,
    };
  }

  let desired = goal;
  let desiredHeading = target.heading;
  let predictedMeters = 0;

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
      Math.max(0, speedMps * elapsedSinceFixSeconds),
    );
    const along = pointAtRouteMeters(model, target.routeMeters + predictedMeters);
    if (along) {
      const drift = distanceKm(raw, along.point) * 1000;
      if (drift <= 40) {
        desired = along.point;
        desiredHeading = along.heading;
      }
    }
  }

  const tau = jumpMeters > 350 ? 0.12 : jumpMeters > 80 ? 0.18 : 0.24;
  const t = damp(dtSeconds, tau);

  return {
    lng: lerp(current.lng, desired.lng, t),
    lat: lerp(current.lat, desired.lat, t),
    heading: lerpAngle(current.heading, desiredHeading, t),
    predictedMeters,
  };
}
