import {
  CITY_TRAFFIC_MAP_CAP,
  CITY_TRAFFIC_NEARBY_KM,
  CITY_TRAFFIC_PRIORITY_KM,
  CITY_TRAFFIC_ROUTE_BUFFER_KM,
} from "@/lib/traffic-constants";
import { distanceKm } from "@/lib/geo";
import type { LngLat, MapViewport, TrafficLevel, TrafficSegment } from "@/types/domain";

const LEVEL_WEIGHT: Record<TrafficLevel, number> = {
  blocked: 5,
  severe: 4,
  congested: 3,
  slow: 2,
  smooth: 0,
};

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
    .filter(
      (segment) =>
        Number.isFinite(segment.distanceKm) &&
        (segment.nearby ||
          segment.alongRoute ||
          segment.level === "blocked" ||
          segment.level === "severe" ||
          segment.level === "congested"),
    )
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
    zoom < 13 ? 16 : zoom < 15 ? 24 : zoom < 17 ? 32 : CITY_TRAFFIC_MAP_CAP;

  const focused =
    maxDistanceKm == null
      ? scored
      : scored.filter(
          (segment) =>
            segment.distanceKm <= maxDistanceKm || segment.alongRoute,
        );

  const nearby = focused.filter(
    (segment) =>
      segment.nearby ||
      segment.alongRoute ||
      segment.level === "blocked" ||
      segment.level === "severe" ||
      segment.level === "congested",
  );
  const inView = viewport
    ? nearby.filter((segment) =>
        segment.coordinates.some(
          ([lng, lat]) =>
            lng >= viewport.bounds.west &&
            lng <= viewport.bounds.east &&
            lat >= viewport.bounds.south &&
            lat <= viewport.bounds.north,
        ),
      )
    : nearby;

  const pool = inView.length ? inView : nearby;
  const preferred = pool.filter(
    (segment) =>
      segment.alongRoute ||
      segment.level === "blocked" ||
      segment.level === "severe" ||
      segment.level === "congested" ||
      segment.distanceKm <= CITY_TRAFFIC_PRIORITY_KM,
  );
  const rest = pool.filter((segment) => !preferred.includes(segment));
  return [...preferred, ...rest].slice(0, limit);
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
