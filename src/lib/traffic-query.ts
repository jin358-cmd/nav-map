import {
  CITY_TRAFFIC_MAP_CAP,
  CITY_TRAFFIC_NEARBY_KM,
  CITY_TRAFFIC_PRIORITY_KM,
  CITY_TRAFFIC_ROUTE_BUFFER_KM,
  COUNTY_TRAFFIC_MAP_CAP,
} from "@/lib/traffic-constants";
import { distanceKm } from "@/lib/geo";
import type { LngLat, MapViewport, TrafficLevel, TrafficSegment } from "@/types/domain";

const LEVEL_WEIGHT: Record<TrafficLevel, number> = {
  blocked: 5,
  severe: 4,
  congested: 3,
  slow: 2,
  smooth: 0,
  unknown: 0,
};

const BAND_WEIGHT = {
  red: 3,
  yellow: 2,
  green: 1,
  unknown: 0,
} as const;

export type ScoredTrafficSegment = TrafficSegment & {
  distanceKm: number;
  alongRoute: boolean;
  nearby: boolean;
};

export function segmentAnchor(segment: TrafficSegment): LngLat {
  const mid =
    segment.coordinates[Math.floor(segment.coordinates.length / 2)] ??
    segment.coordinates[0];
  return { lng: mid[0], lat: mid[1] };
}

export function minDistanceToSegment(
  origin: LngLat,
  segment: TrafficSegment,
): number {
  let min = Infinity;
  for (const [lng, lat] of segment.coordinates) {
    min = Math.min(min, distanceKm(origin, { lng, lat }));
  }
  return min;
}

export function isSegmentAlongRoute(
  segment: TrafficSegment,
  route: [number, number][],
  thresholdKm = CITY_TRAFFIC_ROUTE_BUFFER_KM,
): boolean {
  if (route.length < 2) return false;
  const sampled = sampleLine(route, 10);
  return segment.coordinates.some(([lng, lat]) =>
    sampled.some(
      (coord) =>
        distanceKm({ lng, lat }, { lng: coord[0], lat: coord[1] }) <=
        thresholdKm,
    ),
  );
}

export function scoreTraffic(
  segments: TrafficSegment[],
  origin: LngLat,
  route: [number, number][],
): ScoredTrafficSegment[] {
  return segments
    .map((segment) => {
      const km = minDistanceToSegment(origin, segment);
      return {
        ...segment,
        distanceKm: km,
        alongRoute: isSegmentAlongRoute(segment, route),
        nearby: km <= CITY_TRAFFIC_NEARBY_KM,
      };
    })
    .filter((segment) => Number.isFinite(segment.distanceKm))
    .sort((a, b) => {
      const aRank =
        LEVEL_WEIGHT[a.level] * 3 +
        Number(a.alongRoute) * 4 +
        Number(a.distanceKm <= CITY_TRAFFIC_PRIORITY_KM);
      const bRank =
        LEVEL_WEIGHT[b.level] * 3 +
        Number(b.alongRoute) * 4 +
        Number(b.distanceKm <= CITY_TRAFFIC_PRIORITY_KM);
      if (bRank !== aRank) return bRank - aRank;
      return a.distanceKm - b.distanceKm;
    });
}

export function mapVisibleTraffic(
  scored: ScoredTrafficSegment[],
  viewport: MapViewport | null,
  maxDistanceKm?: number,
): ScoredTrafficSegment[] {
  const zoom = viewport?.zoom ?? 16;
  const limit =
    zoom < 12
      ? COUNTY_TRAFFIC_MAP_CAP
      : zoom < 14
        ? 400
        : zoom < 16
          ? 240
          : CITY_TRAFFIC_MAP_CAP;

  const inViewport = (segment: ScoredTrafficSegment) =>
    viewport
      ? segment.coordinates.some(
          ([lng, lat]) =>
            lng >= viewport.bounds.west &&
            lng <= viewport.bounds.east &&
            lat >= viewport.bounds.south &&
            lat <= viewport.bounds.north,
        )
      : segment.nearby || segment.alongRoute;

  const focused =
    maxDistanceKm == null || viewport
      ? scored.filter(inViewport)
      : scored.filter(
          (segment) =>
            segment.distanceKm <= maxDistanceKm || segment.alongRoute,
        );

  return [...focused]
    .sort((a, b) => {
      const band =
        (BAND_WEIGHT[b.congestionBand] ?? 0) - (BAND_WEIGHT[a.congestionBand] ?? 0);
      if (band !== 0) return band;
      if (a.alongRoute !== b.alongRoute) return a.alongRoute ? -1 : 1;
      if (
        (a.distanceKm <= CITY_TRAFFIC_PRIORITY_KM) !==
        (b.distanceKm <= CITY_TRAFFIC_PRIORITY_KM)
      ) {
        return a.distanceKm <= CITY_TRAFFIC_PRIORITY_KM ? -1 : 1;
      }
      return a.distanceKm - b.distanceKm;
    })
    .slice(0, limit);
}

function sampleLine(line: [number, number][], step: number): [number, number][] {
  if (line.length <= 48) return line;
  const sampled: [number, number][] = [];
  for (let i = 0; i < line.length; i += step) {
    sampled.push(line[i]);
  }
  const last = line[line.length - 1];
  if (sampled[sampled.length - 1] !== last) sampled.push(last);
  return sampled;
}
