import {
  pointAtRouteMeters,
  projectToRoute,
  type RouteProgressModel,
} from "@/lib/route-progress";
import type { DisplayPose, LngLat, VehiclePose } from "@/types/domain";

/** Snap onto the route inside this band. A vague accuracy reading cannot widen it past 30 m. */
export function routeSnapLimitMeters(accuracy: number | undefined, wasSnapped: boolean) {
  const sensed = accuracy == null ? 27 : Math.min(30, Math.max(25, accuracy));
  return wasSnapped ? Math.min(36, sensed + 6) : sensed;
}

/**
 * Display-only projection onto the active route. Raw GPS is left untouched
 * for rerouting. Within about 25–30 m the marker uses the route point and
 * the route bearing; farther than that it stays on the raw fix.
 */
export function snapVehicleToRoute({
  raw,
  model,
  previousRouteMeters,
  wasSnapped = false,
}: {
  raw: VehiclePose;
  model: RouteProgressModel;
  previousRouteMeters?: number;
  wasSnapped?: boolean;
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

  const limit = routeSnapLimitMeters(raw.accuracy, wasSnapped);
  if (candidate.distanceMeters > limit) {
    return {
      ...fallback,
      routeMeters: progress,
      snapConfidence: 0,
    };
  }

  return {
    lng: along.point.lng,
    lat: along.point.lat,
    heading: along.heading,
    routeMeters: candidate.routeMeters,
    snapConfidence: Math.max(0, 1 - candidate.distanceMeters / Math.max(limit, 1)),
    snapped: true,
  };
}
