import {
  CRUISE_ZOOM_START_METERS,
  GUIDANCE_ARROW_APPROACH_METERS,
  INTERSECTION_APPROACH_METERS,
  MANEUVER_AFTER_TURN_METERS,
  PREPARE_ZOOM_METERS,
  TURN_VIEW_METERS,
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

export function lineLengthMeters(line: [number, number][]) {
  let total = 0;
  for (let index = 1; index < line.length; index += 1) {
    total +=
      distanceKm(
        { lng: line[index - 1][0], lat: line[index - 1][1] },
        { lng: line[index][0], lat: line[index][1] },
      ) * 1000;
  }
  return total;
}

/** 依可視路段、距離與 zoom 動態間距：Approach 6～10，路口 8～14。 */
export function chevronCount(
  pathLength: number,
  distanceToNext: number,
  zoom: number,
) {
  if (pathLength <= 0) return 0;
  const near = distanceToNext <= TURN_VIEW_METERS;
  const mid = distanceToNext <= 100;
  const min = near ? 8 : mid ? 7 : 6;
  const max = near ? 14 : mid ? 12 : 10;
  const zoomScale = zoom >= 18 ? 0.78 : zoom >= 17 ? 0.9 : 1;
  return Math.round(
    Math.min(max, Math.max(min, pathLength / (10.2 * zoomScale))),
  );
}

export function marqueeSpacingMeters(
  pathLength: number,
  zoom: number,
  distanceToNext = GUIDANCE_ARROW_APPROACH_METERS,
) {
  if (pathLength <= 0) return 10;
  const desired = chevronCount(pathLength, distanceToNext, zoom);
  if (desired <= 0) return 12;
  return Math.min(16, Math.max(7.5, pathLength / desired));
}

export function guidanceArrowsAlong(
  line: [number, number][],
  spacingMeters: number,
  phase = 0,
  intensity = 1,
): GuidanceArrow[] {
  if (line.length < 2) return [];
  const arrows: GuidanceArrow[] = [];
  let leftover = spacingMeters * 0.62;

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
  const head = cycle * count;
  return arrows.map((arrow, index) => {
    let dist = Math.abs(index - head);
    dist = Math.min(dist, count - dist);
    const highlight = dist < 0.55 ? 1 : dist < 1.15 ? 0.72 : 0.44;
    return {
      ...arrow,
      opacity: Math.max(
        0.32,
        Math.min(1, intensity * highlight),
      ),
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

/**
 * 距離插值：>500m=0，200m≈0.42，50m=1。體感偏快但仍連續。
 */
export function approachCameraProgress(distanceToNext: number) {
  if (!Number.isFinite(distanceToNext)) return 0;
  if (distanceToNext >= CRUISE_ZOOM_START_METERS) return 0;
  if (distanceToNext <= TURN_VIEW_METERS) return 1;
  if (distanceToNext >= PREPARE_ZOOM_METERS) {
    return ((CRUISE_ZOOM_START_METERS - distanceToNext) /
      (CRUISE_ZOOM_START_METERS - PREPARE_ZOOM_METERS)) *
      0.42;
  }
  return (
    0.42 +
    ((PREPARE_ZOOM_METERS - distanceToNext) /
      (PREPARE_ZOOM_METERS - TURN_VIEW_METERS)) *
      0.58
  );
}

/** @deprecated 改用 approachCameraProgress；保留給舊呼叫。 */
export function junctionZoomProgress(distanceToNext: number) {
  return approachCameraProgress(distanceToNext);
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
