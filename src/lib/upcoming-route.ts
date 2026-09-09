import {
  GROUND_BOW_APPROACH_METERS,
  GROUND_BOW_EXIT_METERS,
  GUIDANCE_SIGN_APPROACH_METERS,
  GUIDANCE_SIGN_EXIT_METERS,
  INTERSECTION_APPROACH_METERS,
  MANEUVER_AFTER_TURN_METERS,
  MANEUVER_APPROACH_METERS,
  MANEUVER_IMMINENT_METERS,
  PORTRAIT_APPROACH_ZOOM_FULL_METERS,
  PORTRAIT_APPROACH_ZOOM_START_METERS,
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

/** Web Mercator Y so interpolated points sit on the MapLibre-drawn chord. */
function mercatorLatToY(lat: number) {
  const clamped = Math.max(-85.05112878, Math.min(85.05112878, lat));
  const sine = Math.sin((clamped * Math.PI) / 180);
  return 0.5 * Math.log((1 + sine) / (1 - sine));
}

function mercatorYToLat(y: number) {
  return (Math.atan(Math.sinh(y)) * 180) / Math.PI;
}

function pointAt(segment: RouteSegment, meters: number): [number, number] {
  const ratio = segment.lengthMeters
    ? Math.max(0, Math.min(1, (meters - segment.startMeters) / segment.lengthMeters))
    : 0;
  if (ratio <= 0) return [segment.from[0], segment.from[1]];
  if (ratio >= 1) return [segment.to[0], segment.to[1]];
  const lng =
    segment.from[0] + (segment.to[0] - segment.from[0]) * ratio;
  const y0 = mercatorLatToY(segment.from[1]);
  const y1 = mercatorLatToY(segment.to[1]);
  return [lng, mercatorYToLat(y0 + (y1 - y0) * ratio)];
}

function interpolateAlong(
  segments: RouteSegment[],
  meters: number,
): { lng: number; lat: number; segment: RouteSegment } | null {
  if (!segments.length) return null;
  let remaining = Math.max(0, meters);
  for (let index = 0; index < segments.length; index += 1) {
    const segment = segments[index];
    const last = index === segments.length - 1;
    if (remaining <= segment.lengthMeters || last) {
      const at = pointAt(
        segment,
        segment.startMeters + Math.min(remaining, segment.lengthMeters),
      );
      return { lng: at[0], lat: at[1], segment };
    }
    remaining -= segment.lengthMeters;
  }
  return null;
}

/** Chord length used to smooth jagged vertex bearings onto the road tangent. */
const BEARING_CHORD_METERS = 12;

function poseAlongSegments(
  segments: RouteSegment[],
  meters: number,
): { lng: number; lat: number; bearing: number } | null {
  const point = interpolateAlong(segments, meters);
  if (!point) return null;
  const back = interpolateAlong(
    segments,
    Math.max(0, meters - BEARING_CHORD_METERS * 0.35),
  );
  const forward = interpolateAlong(segments, meters + BEARING_CHORD_METERS);
  const from = back ?? point;
  const to = forward ?? point;
  const same =
    Math.abs(from.lng - to.lng) < 1e-12 && Math.abs(from.lat - to.lat) < 1e-12;
  return {
    lng: point.lng,
    lat: point.lat,
    bearing: same
      ? bearingDegrees(
          { lng: point.segment.from[0], lat: point.segment.from[1] },
          { lng: point.segment.to[0], lat: point.segment.to[1] },
        )
      : bearingDegrees(
          { lng: from.lng, lat: from.lat },
          { lng: to.lng, lat: to.lat },
        ),
  };
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
  distanceToNext = GUIDANCE_SIGN_APPROACH_METERS,
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
 * 橫式／一般：>200m cruise，200→100 拉近，100 Approach，30 Turn View。
 * 直式：黃線（150m）起逐漸放大，45m 達上限後不再放大。
 */
export function approachCameraProgress(
  distanceToNext: number,
  portrait = false,
) {
  if (!Number.isFinite(distanceToNext)) return 0;
  if (portrait) {
    if (distanceToNext > PORTRAIT_APPROACH_ZOOM_START_METERS) return 0;
    if (distanceToNext <= PORTRAIT_APPROACH_ZOOM_FULL_METERS) return 1;
    return (
      (PORTRAIT_APPROACH_ZOOM_START_METERS - distanceToNext) /
      (PORTRAIT_APPROACH_ZOOM_START_METERS - PORTRAIT_APPROACH_ZOOM_FULL_METERS)
    );
  }
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
  return shouldShowGuidanceSigns(distanceToNext);
}

export function shouldShowGuidanceSigns(
  distanceToNext: number,
  wasShowing = false,
) {
  if (!Number.isFinite(distanceToNext)) return false;
  if (wasShowing) return distanceToNext <= GUIDANCE_SIGN_EXIT_METERS;
  return distanceToNext <= GUIDANCE_SIGN_APPROACH_METERS;
}

export function shouldShowGroundBow(
  distanceToNext: number,
  wasShowing = false,
) {
  if (!Number.isFinite(distanceToNext)) return false;
  if (wasShowing) return distanceToNext <= GROUND_BOW_EXIT_METERS;
  return distanceToNext <= GROUND_BOW_APPROACH_METERS;
}

/** 路口前：車頭沿轉彎軌跡的地面引導線（弓型）。 */
export function turnGuidanceLine(
  route: [number, number][],
  routeMeters: number,
  distanceToNext: number,
  cueMeters?: number,
  wasShowing = false,
): [number, number][] {
  if (route.length < 2 || !shouldShowGroundBow(distanceToNext, wasShowing)) {
    return [];
  }
  const turnAt = Number.isFinite(cueMeters)
    ? Math.max(routeMeters, cueMeters as number)
    : routeMeters + Math.max(0, distanceToNext);
  const ahead = Math.max(72, turnAt - routeMeters + 56);
  return sliceRouteAhead(route, routeMeters + 4, ahead);
}

function bowApproach(distanceToNext: number) {
  if (distanceToNext <= 50) return 1;
  if (distanceToNext >= GROUND_BOW_APPROACH_METERS) return 0;
  if (distanceToNext <= 100) {
    return 0.55 + 0.45 * ((100 - distanceToNext) / 50);
  }
  return (
    0.55 *
    ((GROUND_BOW_APPROACH_METERS - distanceToNext) /
      (GROUND_BOW_APPROACH_METERS - 100))
  );
}

function bowSpacingMeters(distanceToNext: number) {
  return 28 - bowApproach(distanceToNext) * 13;
}

/** 藍色地面弓型箭頭：釘在轉彎軌跡上，不沿路跑動；phase 只驅動流水燈光。 */
export function turnGroundArrows({
  route,
  routeMeters,
  distanceToNext,
  cueMeters,
  phase = 0,
  wasShowing = false,
}: {
  route: [number, number][];
  routeMeters: number;
  distanceToNext: number;
  cueMeters?: number;
  phase?: number;
  wasShowing?: boolean;
}): GuidanceArrow[] {
  if (route.length < 2 || !shouldShowGroundBow(distanceToNext, wasShowing)) {
    return [];
  }
  const turnAt = Number.isFinite(cueMeters)
    ? Math.max(routeMeters, cueMeters as number)
    : routeMeters + Math.max(0, distanceToNext);
  const spacing = 14;
  const start = routeMeters + 8;
  const end = turnAt + 36;
  const first = turnAt - Math.ceil((turnAt - start) / spacing) * spacing;
  const span = Math.max(1, end - start);
  const cycle = ((phase % 1) + 1) % 1;
  const placed: GuidanceArrow[] = [];
  const segments = segmentsFromRoute(route);

  for (let at = first; at <= end + 0.01; at += spacing) {
    if (at < start) continue;
    const point = poseAlongSegments(segments, at);
    if (!point) continue;
    const t = (at - start) / span;
    const delta = (t - cycle + 1) % 1;
    const pulse = delta < 0.3 ? 1 - delta / 0.3 : 0;
    placed.push({
      lng: point.lng,
      lat: point.lat,
      bearing: point.bearing,
      opacity: 0.22 + pulse * 0.78,
      kind: "straight",
      scale: 1,
    });
  }
  return placed;
}

/** @deprecated 改用 turnGroundArrows；保留給舊呼叫。 */
export function turnMarqueeArrows(
  line: [number, number][],
  phase = 0,
  distanceToNext = GROUND_BOW_APPROACH_METERS,
): GuidanceArrow[] {
  if (line.length < 2) return [];
  const spacing = bowSpacingMeters(distanceToNext);
  const total = lineLengthMeters(line);
  const placed: GuidanceArrow[] = [];
  const cycle = ((phase % 1) + 1) % 1;
  let leftover = (0.28 - cycle) * spacing;
  if (leftover < 0) leftover += spacing;
  let along = 0;

  for (let index = 1; index < line.length; index += 1) {
    const from = { lng: line[index - 1][0], lat: line[index - 1][1] };
    const to = { lng: line[index][0], lat: line[index][1] };
    const length = distanceKm(from, to) * 1000;
    if (length < 0.5) {
      along += length;
      continue;
    }
    const bearing = bearingDegrees(from, to);
    let cursor = leftover;
    while (cursor < length) {
      const at = along + cursor;
      if (cursor >= 0 && at >= 6) {
        const ratio = cursor / length;
        const t = total > 0 ? Math.min(1, Math.max(0, at / total)) : 0;
        const delta = (t - cycle + 1) % 1;
        const pulse = delta < 0.3 ? 1 - delta / 0.3 : 0;
        placed.push({
          lng: from.lng + (to.lng - from.lng) * ratio,
          lat: from.lat + (to.lat - from.lat) * ratio,
          bearing,
          opacity: 0.22 + pulse * 0.78,
          kind: "straight",
          scale: 1,
        });
      }
      cursor += spacing;
    }
    leftover = cursor - length;
    along += length;
  }
  return placed;
}

export function pointAlongRoute(
  coordinates: [number, number][],
  meters: number,
): { lng: number; lat: number; bearing: number } | null {
  if (coordinates.length < 2) return null;
  return poseAlongSegments(segmentsFromRoute(coordinates), meters);
}

export type GuidanceBowSign = {
  lng: number;
  lat: number;
  bearing: number;
  kind: GuidanceArrowKind;
  scale: number;
  opacity: number;
  role: "hero" | "approach";
};

export function guidanceBowSigns({
  route,
  routeMeters,
  distanceToNext,
  cueMeters,
}: {
  route: [number, number][];
  routeMeters: number;
  distanceToNext: number;
  cueMeters?: number;
}): GuidanceBowSign[] {
  if (route.length < 2 || !Number.isFinite(distanceToNext)) return [];
  const turnAt = Number.isFinite(cueMeters)
    ? Math.max(routeMeters, cueMeters as number)
    : routeMeters + Math.max(0, distanceToNext);
  const ahead = sliceRouteAhead(
    route,
    routeMeters,
    Math.max(36, turnAt - routeMeters + 28),
  );
  const turn = findManeuverTurn(ahead);
  const kind: GuidanceArrowKind =
    turn && Math.abs(turn.signed) >= TURN_THRESHOLD_DEG
      ? turn.signed < 0
        ? "left"
        : "right"
      : "straight";
  const hero = pointAlongRoute(route, turnAt);
  if (!hero) return [];

  const heroScale =
    distanceToNext <= 50 ? 2.72 : distanceToNext <= 100 ? 2.46 : 2.22;
  const signs: GuidanceBowSign[] = [
    {
      ...hero,
      kind,
      scale: heroScale,
      opacity: distanceToNext <= 80 ? 1 : 0.94,
      role: "hero",
    },
  ];

  const first = routeMeters + 22;
  const last = turnAt - 18;
  for (let along = first, index = 0; along < last; along += 42, index += 1) {
    const point = pointAlongRoute(route, along);
    if (!point) continue;
    const t = last <= first ? 1 : (along - first) / (last - first);
    signs.push({
      ...point,
      kind: "straight",
      scale: 1.08 + t * 0.22,
      opacity: 0.72 + t * 0.18,
      role: "approach",
    });
  }
  return signs;
}

export function asLngLat(coord: [number, number]): LngLat {
  return { lng: coord[0], lat: coord[1] };
}
