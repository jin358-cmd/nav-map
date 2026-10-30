import { bearingDegrees } from "@/lib/geo";
import raw from "@/lib/elevated-ground/jianguo-fixture.json";
import { detectElevatedGroundFork } from "@/lib/elevated-ground/fork";
import { distanceMeters, metersAlongRoute, routeLengthMeters } from "@/lib/elevated-ground/geometry";
import type { ElevatedGroundFork, ForkRoute, LngLatPair, RoadRibbon } from "@/lib/elevated-ground/types";
import type { RoutePlan, RouteStep, VehiclePose } from "@/types/domain";

const ribbons = raw.ribbons as RoadRibbon[];

const elevatedRoute: ForkRoute = {
  coordinates: raw.elevated.coordinates as LngLatPair[],
  distanceMeters: raw.elevated.distanceMeters,
  durationSeconds: raw.elevated.durationSeconds,
};

const groundRoute: ForkRoute = {
  coordinates: raw.ground.coordinates as LngLatPair[],
  distanceMeters: raw.ground.distanceMeters,
  durationSeconds: raw.ground.durationSeconds,
};

function pointAtMeters(coordinates: LngLatPair[], meters: number) {
  let traveled = 0;
  for (let index = 1; index < coordinates.length; index += 1) {
    const from = coordinates[index - 1];
    const to = coordinates[index];
    const length = distanceMeters(from, to);
    if (traveled + length >= meters || index === coordinates.length - 1) {
      const ratio = length <= 0 ? 0 : Math.max(0, Math.min(1, (meters - traveled) / length));
      return {
        lng: from[0] + (to[0] - from[0]) * ratio,
        lat: from[1] + (to[1] - from[1]) * ratio,
        heading: bearingDegrees(
          { lng: from[0], lat: from[1] },
          { lng: to[0], lat: to[1] },
        ),
      };
    }
    traveled += length;
  }
  const end = coordinates[coordinates.length - 1];
  return { lng: end[0], lat: end[1], heading: 180 };
}

function stepsFor(route: ForkRoute, decision: LngLatPair): RouteStep[] {
  const start = route.coordinates[0];
  const end = route.coordinates[route.coordinates.length - 1];
  const total = Math.round(routeLengthMeters(route.coordinates));
  const decisionMeters = Math.round(metersAlongRoute(route.coordinates, decision) ?? 0);
  return [
    {
      id: "depart",
      action: "出發",
      roadName: "建國北路三段",
      distanceMeters: decisionMeters,
      cueMeters: 0,
      cumulativeMeters: 0,
      type: "depart",
      location: { lng: start[0], lat: start[1] },
    },
    {
      id: "ahead",
      action: "繼續前行",
      roadName: "建國北路三段",
      distanceMeters: Math.max(0, total - decisionMeters),
      cueMeters: decisionMeters,
      cumulativeMeters: decisionMeters,
      type: "continue",
      modifier: "straight",
      location: { lng: decision[0], lat: decision[1] },
    },
    {
      id: "arrive",
      action: "抵達",
      roadName: "仁愛路",
      distanceMeters: 0,
      cueMeters: total,
      cumulativeMeters: total,
      type: "arrive",
      location: { lng: end[0], lat: end[1] },
    },
  ];
}

function planFor(route: ForkRoute, decision: LngLatPair): RoutePlan {
  const end = route.coordinates[route.coordinates.length - 1];
  return {
    coordinates: route.coordinates,
    distanceMeters: route.distanceMeters,
    durationSeconds: route.durationSeconds,
    travelMode: "car",
    destination: {
      label: "仁愛路",
      address: "臺北市建國高架與平面分岔",
      location: { lng: end[0], lat: end[1] },
    },
    maneuver: {
      distanceMeters: route.distanceMeters,
      action: "繼續前行",
      roadName: "建國北路三段",
      hint: "前方可選高架或平面",
      remainingKm: route.distanceMeters / 1000,
      etaMinutes: route.durationSeconds / 60,
    },
    steps: stepsFor(route, decision),
  };
}

export type JianguoFixture = {
  mode: "near" | "far";
  fork: ElevatedGroundFork;
  ribbons: RoadRibbon[];
  vehicle: VehiclePose;
  route: [number, number][];
  steps: RouteStep[];
  plan: RoutePlan;
  elevatedPlan: RoutePlan;
  groundPlan: RoutePlan;
  dismissMs: number;
};

export function buildJianguoFixture(mode: "near" | "far"): JianguoFixture | null {
  const fork = detectElevatedGroundFork(elevatedRoute, groundRoute, ribbons);
  if (!fork) return null;
  const decisionMeters = metersAlongRoute(elevatedRoute.coordinates, fork.decision) ?? 0;
  const back = mode === "near" ? 120 : 320;
  const place = pointAtMeters(elevatedRoute.coordinates, Math.max(0, decisionMeters - back));
  const elevatedPlan = planFor(elevatedRoute, fork.decision);
  const groundPlan = planFor(groundRoute, fork.decision);
  return {
    mode,
    fork,
    ribbons,
    vehicle: {
      lng: place.lng,
      lat: place.lat,
      heading: place.heading,
      headingAvailable: false,
      accuracy: 8,
      speedMps: 11,
      source: "gps",
      fixedAt: Date.now(),
    },
    route: elevatedRoute.coordinates,
    steps: elevatedPlan.steps,
    plan: elevatedPlan,
    elevatedPlan,
    groundPlan,
    dismissMs: 90_000,
  };
}
