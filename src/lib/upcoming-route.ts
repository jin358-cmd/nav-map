import {
  GUIDANCE_ARROW_APPROACH_METERS,
  INTERSECTION_APPROACH_METERS,
  MANEUVER_AFTER_TURN_METERS,
  MANEUVER_APPROACH_METERS,
  MANEUVER_IMMINENT_METERS,
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

export type GuidanceArrowKind = "straight" | "left" | "right";

export type GuidanceArrow = {
  lng: number;
  lat: number;
  bearing: number;
  opacity: number;
  kind: GuidanceArrowKind;
  scale: number;
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

const VEHICLE_CLEARANCE_M = 16;
const TURN_THRESHOLD_DEG = 24;

function signedHeadingDelta(from: number, to: number) {
  return ((to - from + 540) % 360) - 180;
}

function findManeuverTurn(line: [number, number][]) {
  let meters = 0;
  let best: { meters: number; signed: number } | null = null;
  for (let index = 1; index < line.length; index += 1) {
    const from = { lng: line[index - 1][0], lat: line[index - 1][1] };
    const to = { lng: line[index][0], lat: line[index][1] };
    const length = distanceKm(from, to) * 1000;
    const bearing = bearingDegrees(from, to);
    if (index >= 2) {
      const prev = {
        lng: line[index - 2][0],
        lat: line[index - 2][1],
      };
      const prevBearing = bearingDegrees(prev, from);
      const signed = signedHeadingDelta(prevBearing, bearing);
      if (
        Math.abs(signed) >= TURN_THRESHOLD_DEG &&
        (!best || Math.abs(signed) > Math.abs(best.signed))
      ) {
        best = { meters, signed };
      }
    }
    meters += length;
  }
  return best;
}

/** 前方連續可見約 8～14 個，避免堆疊。 */
export function chevronCount(
  pathLength: number,
  distanceToNext: number,
  zoom: number,
) {
  if (pathLength <= 0) return 0;
  const near = distanceToNext <= TURN_VIEW_METERS;
  const mid = distanceToNext <= MANEUVER_APPROACH_METERS;
  const min = near ? 9 : mid ? 8 : 8;
  const max = near ? 14 : mid ? 12 : 12;
  const zoomScale = zoom >= 18 ? 0.82 : zoom >= 17 ? 0.92 : 1;
  return Math.round(
    Math.min(max, Math.max(min, pathLength / (13 * zoomScale))),
  );
}

export function marqueeSpacingMeters(
  pathLength: number,
  zoom: number,
  distanceToNext = GUIDANCE_ARROW_APPROACH_METERS,
) {
  if (pathLength <= 0) return 13;
  const desired = chevronCount(pathLength, distanceToNext, zoom);
  if (desired <= 0) return 13;
  return Math.min(18, Math.max(12, pathLength / desired));
}

export function guidanceArrowsAlong(
  line: [number, number][],
  spacingMeters: number,
  phase = 0,
  intensity = 1,
): GuidanceArrow[] {
  if (line.length < 2) return [];
  const turn = findManeuverTurn(line);
  const placed: Omit<GuidanceArrow, "opacity" | "scale" | "kind">[] = [];
  let leftover = spacingMeters * 0.35;
  let along = 0;

  for (let index = 1; index < line.length; index += 1) {
    const from = { lng: line[index - 1][0], lat: line[index - 1][1] };
    const to = { lng: line[index][0], lat: line[index][1] };
    const length = distanceKm(from, to) * 1000;
    if (length < 0.4) {
      along += length;
      continue;
    }
    const bearing = bearingDegrees(from, to);
    let cursor = leftover;
    while (cursor < length) {
      const at = along + cursor;
      if (cursor >= 0 && at >= VEHICLE_CLEARANCE_M) {
        const ratio = cursor / length;
        placed.push({
          lng: from.lng + (to.lng - from.lng) * ratio,
          lat: from.lat + (to.lat - from.lat) * ratio,
          bearing,
        });
      }
      cursor += spacingMeters;
    }
    leftover = cursor - length;
    along += length;
  }

  const count = placed.length;
  if (count === 0) return [];
  const cycle = ((phase % 1) + 1) % 1;
  const wave = cycle * count;
  return placed.map((arrow, index) => {
    const t = count === 1 ? 0 : index / (count - 1);
    const scale = 1.18 - t * 0.58;
    const nearBase = 0.46 + 0.34 * (1 - t);
    const dist = index - wave;
    const pulse = dist >= -0.25 && dist <= 1.15 ? 1 - Math.abs(dist) * 0.42 : 0;
    let kind: GuidanceArrowKind = "straight";
    if (turn) {
      const arrowMeters = VEHICLE_CLEARANCE_M + index * spacingMeters;
      if (
        arrowMeters >= turn.meters - 10 &&
        arrowMeters <= turn.meters + 24 &&
        Math.abs(turn.signed) >= TURN_THRESHOLD_DEG
      ) {
        kind = turn.signed < 0 ? "left" : "right";
      }
    }
    return {
      ...arrow,
      kind,
      scale,
      opacity: Math.max(
        0.38,
        Math.min(1, intensity * (nearBase + pulse * 0.42)),
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
 * >200m=cruise，200→100 開始拉近，100=Approach，30=Turn View。
 */
export function approachCameraProgress(distanceToNext: number) {
  if (!Number.isFinite(distanceToNext)) return 0;
  if (distanceToNext > PREPARE_ZOOM_METERS) return 0;
  if (distanceToNext <= MANEUVER_IMMINENT_METERS) return 1;
  if (distanceToNext <= MANEUVER_APPROACH_METERS) {
    return (
      0.62 +
      0.38 *
        ((MANEUVER_APPROACH_METERS - distanceToNext) /
          (MANEUVER_APPROACH_METERS - MANEUVER_IMMINENT_METERS))
    );
  }
  return (
    0.62 *
    ((PREPARE_ZOOM_METERS - distanceToNext) /
      (PREPARE_ZOOM_METERS - MANEUVER_APPROACH_METERS))
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
