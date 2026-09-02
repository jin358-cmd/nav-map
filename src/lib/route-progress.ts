import { distanceKm } from "@/lib/geo";
import type { LngLat, RouteStep, VehiclePose } from "@/types/domain";

type RouteSegment = {
  from: LngLat;
  to: LngLat;
  startMeters: number;
  lengthMeters: number;
};

export type RouteProgressModel = {
  segments: RouteSegment[];
  stepMeters: number[];
  totalMeters: number;
};

export type NavigationProgress = {
  stepIndex: number;
  distanceToNextMeters: number;
  offRoute: boolean;
  routeMeters: number;
};

export type NavigationTrackerState = NavigationProgress & {
  offRouteSamples: number;
  onRouteSamples: number;
  lastVehicle: VehiclePose;
  updatedAt: number;
};

type RouteProjection = {
  routeMeters: number;
  distanceMeters: number;
};

const metersPerLatitudeDegree = 111_320;

function pointOnSegment(
  point: LngLat,
  segment: RouteSegment,
  minimumMeters: number,
  maximumMeters: number,
): RouteProjection {
  const latitude = ((segment.from.lat + segment.to.lat + point.lat) / 3) *
    (Math.PI / 180);
  const metersPerLongitudeDegree =
    metersPerLatitudeDegree * Math.max(Math.cos(latitude), 0.01);
  const bx = (segment.to.lng - segment.from.lng) * metersPerLongitudeDegree;
  const by = (segment.to.lat - segment.from.lat) * metersPerLatitudeDegree;
  const px = (point.lng - segment.from.lng) * metersPerLongitudeDegree;
  const py = (point.lat - segment.from.lat) * metersPerLatitudeDegree;
  const squaredLength = bx * bx + by * by;
  const rawRatio =
    squaredLength > 0
      ? Math.max(0, Math.min(1, (px * bx + py * by) / squaredLength))
      : 0;
  const minimumRatio = segment.lengthMeters
    ? Math.max(0, (minimumMeters - segment.startMeters) / segment.lengthMeters)
    : 0;
  const maximumRatio = segment.lengthMeters
    ? Math.min(1, (maximumMeters - segment.startMeters) / segment.lengthMeters)
    : 1;
  const ratio = Math.max(minimumRatio, Math.min(maximumRatio, rawRatio));
  const dx = px - bx * ratio;
  const dy = py - by * ratio;

  return {
    routeMeters: segment.startMeters + segment.lengthMeters * ratio,
    distanceMeters: Math.hypot(dx, dy),
  };
}

function projectToRoute(
  point: LngLat,
  segments: RouteSegment[],
  minimumMeters = 0,
  maximumMeters = Number.POSITIVE_INFINITY,
): RouteProjection | null {
  let best: RouteProjection | null = null;

  for (const segment of segments) {
    const segmentEnd = segment.startMeters + segment.lengthMeters;
    if (segmentEnd < minimumMeters || segment.startMeters > maximumMeters) {
      continue;
    }
    const projection = pointOnSegment(
      point,
      segment,
      minimumMeters,
      maximumMeters,
    );
    if (!best || projection.distanceMeters < best.distanceMeters) {
      best = projection;
    }
  }

  return best;
}

export function createRouteProgressModel(
  coordinates: [number, number][],
  steps: RouteStep[],
): RouteProgressModel | null {
  if (coordinates.length < 2) return null;

  const segments: RouteSegment[] = [];
  let totalMeters = 0;
  for (let index = 1; index < coordinates.length; index += 1) {
    const [fromLng, fromLat] = coordinates[index - 1];
    const [toLng, toLat] = coordinates[index];
    const from = { lng: fromLng, lat: fromLat };
    const to = { lng: toLng, lat: toLat };
    const lengthMeters = distanceKm(from, to) * 1000;
    segments.push({ from, to, startMeters: totalMeters, lengthMeters });
    totalMeters += lengthMeters;
  }

  let previousStepMeters = 0;
  const stepMeters = steps.map((step) => {
    if (!step.location) return previousStepMeters;
    const projection = projectToRoute(
      step.location,
      segments,
      Math.max(0, previousStepMeters - 5),
    );
    if (!projection) return previousStepMeters;
    previousStepMeters = Math.max(previousStepMeters, projection.routeMeters);
    return previousStepMeters;
  });

  return { segments, stepMeters, totalMeters };
}

function arrivalThreshold(speedMps: number | undefined) {
  const speedAdjustment = Math.max(0, speedMps ?? 0) * 0.8;
  return Math.min(35, Math.max(20, 20 + speedAdjustment));
}

function firstNavigationStep(steps: RouteStep[]) {
  const index = steps.findIndex((step) => step.type !== "depart");
  return index >= 0 ? index : 0;
}

export function updateNavigationProgress({
  model,
  steps,
  vehicle,
  previous,
  now = Date.now(),
}: {
  model: RouteProgressModel;
  steps: RouteStep[];
  vehicle: VehiclePose;
  previous: NavigationTrackerState | null;
  now?: number;
}): NavigationTrackerState | null {
  if (steps.length === 0) return null;

  const nearestProjection = projectToRoute(vehicle, model.segments);
  if (!nearestProjection) return null;

  let routeMeters = nearestProjection.routeMeters;
  if (previous) {
    const elapsedSeconds = Math.max(0, (now - previous.updatedAt) / 1000);
    const movedMeters = distanceKm(previous.lastVehicle, vehicle) * 1000;
    const expectedMeters = Math.max(
      movedMeters,
      (vehicle.speedMps ?? 0) * elapsedSeconds,
    );
    const maximumAdvance = Math.max(25, expectedMeters * 2.5 + 10);
    const localProjection = projectToRoute(
      vehicle,
      model.segments,
      previous.routeMeters,
      Math.min(model.totalMeters, previous.routeMeters + maximumAdvance),
    );
    routeMeters = localProjection?.routeMeters ?? previous.routeMeters;
  }

  const routeTolerance = Math.max(
    45,
    Math.min(80, (vehicle.accuracy ?? 10) * 1.5),
  );
  const outsideRoute = nearestProjection.distanceMeters > routeTolerance;
  const offRouteSamples = outsideRoute ? (previous?.offRouteSamples ?? 0) + 1 : 0;
  const onRouteSamples = outsideRoute ? 0 : (previous?.onRouteSamples ?? 0) + 1;
  const offRoute = previous?.offRoute
    ? onRouteSamples < 2
    : offRouteSamples >= 2;

  let stepIndex = Math.max(
    previous?.stepIndex ?? firstNavigationStep(steps),
    firstNavigationStep(steps),
  );
  const threshold = arrivalThreshold(vehicle.speedMps);
  while (
    stepIndex < steps.length - 1 &&
    routeMeters >= (model.stepMeters[stepIndex] ?? model.totalMeters) - threshold
  ) {
    stepIndex += 1;
  }

  const cueMeters = model.stepMeters[stepIndex] ?? model.totalMeters;
  return {
    stepIndex,
    distanceToNextMeters: Math.max(0, Math.round(cueMeters - routeMeters)),
    offRoute,
    routeMeters,
    offRouteSamples,
    onRouteSamples,
    lastVehicle: vehicle,
    updatedAt: now,
  };
}
