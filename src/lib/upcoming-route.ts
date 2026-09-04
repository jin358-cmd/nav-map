import {
  GUIDANCE_ARROW_APPROACH_METERS,
  INTERSECTION_APPROACH_METERS,
  JUNCTION_FOCUS_MAX_ZOOM_METERS,
  MANEUVER_AFTER_TURN_METERS,
  MANEUVER_APPROACH_METERS,
} from "@/lib/constants";
import { bearingDegrees, distanceKm } from "@/lib/geo";
import type { LngLat } from "@/types/domain";

type RouteSegment = {
  from: [number, number];
  to: [number, number];
  startMeters: number;
  lengthMeters: number;
};

export type GuidanceArrow = {
  lng: number;
  lat: number;
  bearing: number;
  opacity: number;
};

function segmentsFromRoute(coordinates: [number, number][]): RouteSegment[] {
  const segments: RouteSegment[] = [];
  let total = 0;
  for (let index = 1; index < coordinates.length; index += 1) {
    const from = coordinates[index - 1];
    const to = coordinates[index];
    const lengthMeters =
      distanceKm({ lng: from[0], lat: from[1] }, { lng: to[0], lat: to[1] }) *
      1000;
    segments.push({ from, to, startMeters: total, lengthMeters });
    total += lengthMeters;
  }
  return segments;
}

function pointAt(segment: RouteSegment, meters: number): [number, number] {
  const ratio = segment.lengthMeters
    ? Math.max(0, Math.min(1, (meters - segment.startMeters) / segment.lengthMeters))
    : 0;
  return [
    segment.from[0] + (segment.to[0] - segment.from[0]) * ratio,
    segment.from[1] + (segment.to[1] - segment.from[1]) * ratio,
  ];
}

export function sliceRouteAhead(
  coordinates: [number, number][],
  fromMeters: number,
  aheadMeters: number,
): [number, number][] {
  if (coordinates.length < 2 || aheadMeters <= 0) return [];
  const segments = segmentsFromRoute(coordinates);
  const start = Math.max(0, fromMeters);
  const end = start + aheadMeters;
  const points: [number, number][] = [];

  for (const segment of segments) {
    const segmentEnd = segment.startMeters + segment.lengthMeters;
    if (segmentEnd < start || segment.startMeters > end) continue;
    if (!points.length) points.push(pointAt(segment, start));
    points.push(pointAt(segment, Math.min(end, segmentEnd)));
  }

  return points.length >= 2 ? points : [];
}

export function guidanceArrowsAlong(
  line: [number, number][],
  spacingMeters: number,
  phase = 0,
  intensity = 1,
): GuidanceArrow[] {
  if (line.length < 2) return [];
  const arrows: GuidanceArrow[] = [];
  let leftover = spacingMeters * 0.35;

  for (let index = 1; index < line.length; index += 1) {
    const from = { lng: line[index - 1][0], lat: line[index - 1][1] };
    const to = { lng: line[index][0], lat: line[index][1] };
    const length = distanceKm(from, to) * 1000;
    if (length < 0.4) continue;
    const bearing = bearingDegrees(from, to);
    let cursor = leftover;
    while (cursor < length) {
      if (cursor >= 0) {
        const ratio = cursor / length;
        arrows.push({
          lng: from.lng + (to.lng - from.lng) * ratio,
          lat: from.lat + (to.lat - from.lat) * ratio,
          bearing,
          opacity: 1,
        });
      }
      cursor += spacingMeters;
    }
    leftover = cursor - length;
  }

  const count = arrows.length;
  if (count === 0) return arrows;
  const cycle = ((phase % 1) + 1) % 1;
  return arrows.map((arrow, index) => {
    const wave = 0.5 + 0.5 * Math.cos(2 * Math.PI * (index / count - cycle));
    return {
      ...arrow,
      opacity: Math.max(0.18, Math.min(1, intensity * (0.28 + 0.72 * wave))),
    };
  });
}

export function approachLookaheadMeters(distanceToNext: number) {
  return Math.min(
    160,
    Math.max(36, distanceToNext + MANEUVER_AFTER_TURN_METERS),
  );
}

export function isApproachingIntersection(distanceToNext: number) {
  return Number.isFinite(distanceToNext) && distanceToNext <= INTERSECTION_APPROACH_METERS;
}

/** 100 公尺開始放大，越近越接近最大 Zoom（0～1）。 */
export function junctionZoomProgress(distanceToNext: number) {
  if (!Number.isFinite(distanceToNext)) return 0;
  const span = MANEUVER_APPROACH_METERS - JUNCTION_FOCUS_MAX_ZOOM_METERS;
  return Math.max(
    0,
    Math.min(1, (MANEUVER_APPROACH_METERS - distanceToNext) / span),
  );
}

export function shouldShowGuidanceArrows(distanceToNext: number) {
  return (
    Number.isFinite(distanceToNext) &&
    distanceToNext <= GUIDANCE_ARROW_APPROACH_METERS
  );
}

export function asLngLat(coord: [number, number]): LngLat {
  return { lng: coord[0], lat: coord[1] };
}
