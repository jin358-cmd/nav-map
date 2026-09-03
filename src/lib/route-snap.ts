import { headingDelta } from "@/lib/geo";
import {
  pointAtRouteMeters,
  projectToRoute,
  type RouteProgressModel,
} from "@/lib/route-progress";
import type { DisplayPose, LngLat, VehiclePose } from "@/types/domain";

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

/**
 * 把原始 GPS 投影到目前導航路線，供黃色箭頭使用。
 * 不覆寫 GPS；偏離過遠、精度不足或疑似平行路時不強制吸附。
 */
export function snapVehicleToRoute({
  raw,
  model,
  previousRouteMeters,
}: {
  raw: VehiclePose;
  model: RouteProgressModel;
  previousRouteMeters?: number;
}): DisplayPose {
  const rawPosition: LngLat = { lng: raw.lng, lat: raw.lat };
  const fallback: DisplayPose = {
    ...rawPosition,
    heading: raw.heading,
    routeMeters: previousRouteMeters ?? 0,
    snapConfidence: 0,
    snapped: false,
  };

  const nearest = projectToRoute(rawPosition, model.segments);
  if (!nearest) return fallback;

  const progress = previousRouteMeters ?? nearest.routeMeters;
  const speedMps = raw.speedMps ?? 0;
  const accuracy = raw.accuracy ?? 12;
  const lookback = Math.max(28, accuracy);
  const lookahead = Math.max(70, speedMps * 3.2 + accuracy);

  const local = projectToRoute(
    rawPosition,
    model.segments,
    Math.max(0, progress - lookback),
    Math.min(model.totalMeters, progress + lookahead),
  );

  const candidate = local ?? nearest;
  const along = pointAtRouteMeters(model, candidate.routeMeters);
  if (!along) return fallback;

  const headingGap = headingDelta(raw.heading, along.heading);
  const snapMaxMeters = Math.max(22, Math.min(55, accuracy * 1.6));
  const parallelRisk =
    nearest.distanceMeters + 8 < candidate.distanceMeters &&
    Math.abs(nearest.routeMeters - progress) > 80;
  const headingReject = speedMps > 2 && headingGap > 55;
  const accuracyReject = accuracy > 50;
  const distanceReject = candidate.distanceMeters > snapMaxMeters;

  const distScore = 1 - clamp(candidate.distanceMeters / snapMaxMeters, 0, 1);
  const headingScore = 1 - clamp(headingGap / 70, 0, 1);
  const accuracyScore = 1 - clamp((accuracy - 8) / 42, 0, 1);
  const snapConfidence = clamp(
    distScore * 0.45 + headingScore * 0.3 + accuracyScore * 0.25,
    0,
    1,
  );

  const snapped =
    snapConfidence >= 0.48 &&
    !parallelRisk &&
    !headingReject &&
    !accuracyReject &&
    !distanceReject;

  if (!snapped) {
    return {
      ...fallback,
      routeMeters: progress,
      snapConfidence,
    };
  }

  return {
    lng: along.point.lng,
    lat: along.point.lat,
    heading: along.heading,
    routeMeters: candidate.routeMeters,
    snapConfidence,
    snapped: true,
  };
}
