import type { LngLatPair } from "@/lib/elevated-ground/types";

const METERS_PER_DEGREE = 111_320;

export function distanceMeters(a: LngLatPair, b: LngLatPair): number {
  const lat = ((a[1] + b[1]) / 2) * (Math.PI / 180);
  const x = (b[0] - a[0]) * METERS_PER_DEGREE * Math.cos(lat);
  const y = (b[1] - a[1]) * METERS_PER_DEGREE;
  return Math.hypot(x, y);
}

export function distanceToSegment(
  point: LngLatPair,
  from: LngLatPair,
  to: LngLatPair,
): number {
  const lat = ((from[1] + to[1] + point[1]) / 3) * (Math.PI / 180);
  const mx = METERS_PER_DEGREE * Math.max(Math.cos(lat), 0.01);
  const my = METERS_PER_DEGREE;
  const vx = (to[0] - from[0]) * mx;
  const vy = (to[1] - from[1]) * my;
  const px = (point[0] - from[0]) * mx;
  const py = (point[1] - from[1]) * my;
  const squared = vx * vx + vy * vy;
  const t = squared === 0 ? 0 : Math.max(0, Math.min(1, (px * vx + py * vy) / squared));
  return Math.hypot(px - vx * t, py - vy * t);
}

export function distanceToLine(point: LngLatPair, line: LngLatPair[]): number {
  let best = Number.POSITIVE_INFINITY;
  for (let index = 1; index < line.length; index += 1) {
    best = Math.min(best, distanceToSegment(point, line[index - 1], line[index]));
  }
  return best;
}

export function distanceToLines(point: LngLatPair, lines: LngLatPair[][]): number {
  let best = Number.POSITIVE_INFINITY;
  for (const line of lines) best = Math.min(best, distanceToLine(point, line));
  return best;
}

export type RouteSample = { point: LngLatPair; meters: number };

export function routeLengthMeters(coordinates: LngLatPair[]): number {
  let total = 0;
  for (let index = 1; index < coordinates.length; index += 1) {
    total += distanceMeters(coordinates[index - 1], coordinates[index]);
  }
  return total;
}

export function resampleRoute(coordinates: LngLatPair[], stepMeters = 15): RouteSample[] {
  if (coordinates.length === 0) return [];
  const samples: RouteSample[] = [{ point: coordinates[0], meters: 0 }];
  if (coordinates.length === 1) return samples;
  let traveled = 0;
  let nextMark = stepMeters;
  for (let index = 1; index < coordinates.length; index += 1) {
    const from = coordinates[index - 1];
    const to = coordinates[index];
    const length = distanceMeters(from, to);
    if (length <= 0) continue;
    while (traveled + length >= nextMark - 1e-6) {
      const t = Math.max(0, Math.min(1, (nextMark - traveled) / length));
      samples.push({
        point: [
          from[0] + (to[0] - from[0]) * t,
          from[1] + (to[1] - from[1]) * t,
        ],
        meters: nextMark,
      });
      nextMark += stepMeters;
    }
    traveled += length;
  }
  const end = coordinates[coordinates.length - 1];
  const last = samples[samples.length - 1];
  if (!last || distanceMeters(last.point, end) > 1) {
    samples.push({ point: end, meters: traveled });
  } else {
    samples[samples.length - 1] = { point: end, meters: traveled };
  }
  return samples;
}

export function metersAlongRoute(
  coordinates: LngLatPair[],
  point: LngLatPair,
): number | null {
  if (coordinates.length < 2) return null;
  let best = Number.POSITIVE_INFINITY;
  let bestMeters = 0;
  let traveled = 0;
  for (let index = 1; index < coordinates.length; index += 1) {
    const from = coordinates[index - 1];
    const to = coordinates[index];
    const length = distanceMeters(from, to);
    const lat = ((from[1] + to[1] + point[1]) / 3) * (Math.PI / 180);
    const mx = METERS_PER_DEGREE * Math.max(Math.cos(lat), 0.01);
    const my = METERS_PER_DEGREE;
    const vx = (to[0] - from[0]) * mx;
    const vy = (to[1] - from[1]) * my;
    const px = (point[0] - from[0]) * mx;
    const py = (point[1] - from[1]) * my;
    const squared = vx * vx + vy * vy;
    const t = squared === 0 ? 0 : Math.max(0, Math.min(1, (px * vx + py * vy) / squared));
    const gap = Math.hypot(px - vx * t, py - vy * t);
    if (gap < best) {
      best = gap;
      bestMeters = traveled + length * t;
    }
    traveled += length;
  }
  return bestMeters;
}

export function closestPointOnLines(
  point: LngLatPair,
  lines: LngLatPair[][],
): { point: LngLatPair; bearing: number } | null {
  let best = Number.POSITIVE_INFINITY;
  let chosen: { point: LngLatPair; bearing: number } | null = null;
  for (const line of lines) {
    for (let index = 1; index < line.length; index += 1) {
      const from = line[index - 1];
      const to = line[index];
      const lat = ((from[1] + to[1] + point[1]) / 3) * (Math.PI / 180);
      const mx = METERS_PER_DEGREE * Math.max(Math.cos(lat), 0.01);
      const my = METERS_PER_DEGREE;
      const vx = (to[0] - from[0]) * mx;
      const vy = (to[1] - from[1]) * my;
      const px = (point[0] - from[0]) * mx;
      const py = (point[1] - from[1]) * my;
      const squared = vx * vx + vy * vy;
      const t = squared === 0 ? 0 : Math.max(0, Math.min(1, (px * vx + py * vy) / squared));
      const gap = Math.hypot(px - vx * t, py - vy * t);
      if (gap < best) {
        best = gap;
        chosen = {
          point: [
            from[0] + (to[0] - from[0]) * t,
            from[1] + (to[1] - from[1]) * t,
          ],
          bearing: Math.atan2(to[0] - from[0], to[1] - from[1]),
        };
      }
    }
  }
  return chosen;
}

export function bearingsParallel(a: number, b: number, maxRadians: number): boolean {
  const raw = Math.abs(a - b) % Math.PI;
  const delta = raw > Math.PI / 2 ? Math.PI - raw : raw;
  return delta <= maxRadians;
}

export function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.floor((sorted.length - 1) / 2)];
}
