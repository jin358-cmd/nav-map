import {
  bearingsParallel,
  closestPointOnLines,
  distanceMeters,
  distanceToLine,
  distanceToLines,
  median,
  resampleRoute,
  type RouteSample,
} from "@/lib/elevated-ground/geometry";
import {
  ELEVATED_MEDIAN_MAX_METERS,
  GROUND_MEDIAN_MIN_METERS,
  MAX_SPLIT_METERS,
  MEDIAN_GAP_METERS,
  MIN_SPLIT_METERS,
  SAME_PATH_METERS,
  SPLIT_LENGTH_RATIO,
  type ElevatedGroundFork,
  type ForkRoute,
  type LngLatPair,
  type RoadRibbon,
} from "@/lib/elevated-ground/types";

const ELEVATED_CLASSES = new Set(["motorway", "trunk", "primary", "secondary"]);
const GROUND_CLASSES = new Set([
  "motorway",
  "trunk",
  "primary",
  "secondary",
  "tertiary",
  "minor",
]);

export function elevatedCenterlines(ribbons: RoadRibbon[]): LngLatPair[][] {
  return ribbons.flatMap((ribbon) => {
    if (!ribbon.elevated || !ELEVATED_CLASSES.has(ribbon.roadClass)) return [];
    if (ribbon.line.length < 2) return [];
    return [ribbon.line];
  });
}

function forkId(point: LngLatPair): string {
  return `${point[0].toFixed(3)},${point[1].toFixed(3)}`;
}

function bridgeMedian(points: LngLatPair[], bridges: LngLatPair[][]): number | null {
  if (points.length === 0 || bridges.length === 0) return null;
  return median(points.map((point) => distanceToLines(point, bridges)));
}

type SplitRun = { start: number; end: number };

function splitRuns(samples: RouteSample[], other: LngLatPair[]): SplitRun[] {
  const shared = samples.map((sample) => distanceToLine(sample.point, other) <= SAME_PATH_METERS);
  const runs: SplitRun[] = [];
  let start = -1;
  for (let index = 0; index < shared.length; index += 1) {
    if (!shared[index] && start < 0) start = index;
    if (shared[index] && start >= 0) {
      runs.push({ start, end: index - 1 });
      start = -1;
    }
  }
  if (start >= 0) runs.push({ start, end: samples.length - 1 });
  return runs;
}

function runIsFork(
  samples: RouteSample[],
  run: SplitRun,
  other: LngLatPair[],
): boolean {
  const length = samples[run.end].meters - samples[run.start].meters;
  if (length < MIN_SPLIT_METERS || length > MAX_SPLIT_METERS) return false;
  const opened = run.start > 0;
  const closed = run.end < samples.length - 1;
  const endsTogether =
    distanceMeters(samples[samples.length - 1].point, other[other.length - 1]) <= 60;
  if (!opened) return false;
  if (!closed && !endsTogether) return false;
  const otherSamples = resampleRoute(other, 15);
  const otherSplit = otherSamples.filter(
    (sample) => distanceToLine(sample.point, samples.map((item) => item.point)) > SAME_PATH_METERS,
  );
  if (otherSplit.length < 2) return false;
  const otherLength =
    otherSplit[otherSplit.length - 1].meters - otherSplit[0].meters;
  const shorter = Math.max(1, Math.min(length, otherLength));
  const longer = Math.max(length, otherLength);
  if (longer > shorter * SPLIT_LENGTH_RATIO) return false;
  return true;
}

function pointsForMedian(samples: RouteSample[], run: SplitRun): LngLatPair[] {
  const startMeters = samples[run.start].meters + 20;
  const endMeters = samples[run.end].meters - 20;
  const inner = samples.filter(
    (sample, index) =>
      index >= run.start &&
      index <= run.end &&
      sample.meters >= startMeters &&
      sample.meters <= endMeters,
  );
  const chosen = inner.length >= 3
    ? inner
    : samples.filter((_, index) => index >= run.start && index <= run.end);
  return chosen.map((sample) => sample.point);
}

export function detectElevatedGroundFork(
  first: ForkRoute,
  second: ForkRoute,
  ribbons: RoadRibbon[],
): ElevatedGroundFork | null {
  if (first.coordinates.length < 2 || second.coordinates.length < 2) return null;
  const bridges = elevatedCenterlines(ribbons);
  if (bridges.length === 0) return null;
  const samples = resampleRoute(first.coordinates, 15);
  if (samples.length < 4) return null;
  const runs = splitRuns(samples, second.coordinates).filter((run) =>
    runIsFork(samples, run, second.coordinates),
  );
  const otherSamples = resampleRoute(second.coordinates, 15);
  for (const run of runs) {
    const firstPoints = pointsForMedian(samples, run);
    const otherPoints = otherSamples
      .filter((sample) => distanceToLine(sample.point, first.coordinates) > SAME_PATH_METERS)
      .map((sample) => sample.point);
    const firstMedian = bridgeMedian(firstPoints, bridges);
    const otherMedian = bridgeMedian(otherPoints, bridges);
    if (firstMedian == null || otherMedian == null) continue;
    const elevatedIsFirst =
      firstMedian <= ELEVATED_MEDIAN_MAX_METERS &&
      otherMedian >= GROUND_MEDIAN_MIN_METERS &&
      otherMedian - firstMedian >= MEDIAN_GAP_METERS;
    const elevatedIsSecond =
      otherMedian <= ELEVATED_MEDIAN_MAX_METERS &&
      firstMedian >= GROUND_MEDIAN_MIN_METERS &&
      firstMedian - otherMedian >= MEDIAN_GAP_METERS;
    if (!elevatedIsFirst && !elevatedIsSecond) continue;
    const decision = samples[Math.max(0, run.start - 1)].point;
    const rejoin = run.end < samples.length - 1 ? samples[run.end + 1].point : samples[run.end].point;
    return {
      id: forkId(decision),
      decision,
      rejoin,
      elevated: elevatedIsFirst ? first : second,
      ground: elevatedIsFirst ? second : first,
    };
  }
  return null;
}

export function elevatedRoadNearby(
  route: LngLatPair[],
  ribbons: RoadRibbon[],
  fromMeters: number,
): boolean {
  const bridges = elevatedCenterlines(ribbons);
  if (bridges.length === 0 || route.length < 2) return false;
  return resampleRoute(route, 25).some(
    (sample) =>
      sample.meters >= fromMeters &&
      sample.meters <= fromMeters + 1_500 &&
      distanceToLines(sample.point, bridges) <= 40,
  );
}

export function pickForkVias(
  route: LngLatPair[],
  ribbons: RoadRibbon[],
  fromMeters = 0,
): { elevated: LngLatPair; ground: LngLatPair } | null {
  const bridges = elevatedCenterlines(ribbons);
  if (bridges.length === 0 || route.length < 2) return null;
  const samples = resampleRoute(route, 20).filter(
    (sample) => sample.meters >= fromMeters && sample.meters <= fromMeters + 1_600,
  );
  let start = -1;
  let best: SplitRun | null = null;
  const near = samples.map((sample) => distanceToLines(sample.point, bridges) <= 40);
  const takeRun = (end: number, current: SplitRun | null, runStart: number) => {
    if (runStart < 0) return current;
    const length = samples[end].meters - samples[runStart].meters;
    if (length < MIN_SPLIT_METERS) return current;
    if (!current || end - runStart > current.end - current.start) {
      return { start: runStart, end };
    }
    return current;
  };
  for (let index = 0; index < near.length; index += 1) {
    if (near[index] && start < 0) start = index;
    if (!near[index]) {
      best = takeRun(index - 1, best, start);
      start = -1;
    }
  }
  best = takeRun(samples.length - 1, best, start);
  if (!best) return null;
  const chosen: SplitRun = best;
  const target = samples[chosen.start].meters + 100;
  let viaSample = samples[chosen.start];
  for (let index = chosen.start; index <= chosen.end; index += 1) {
    if (Math.abs(samples[index].meters - target) < Math.abs(viaSample.meters - target)) {
      viaSample = samples[index];
    }
  }
  const elevatedHit = closestPointOnLines(viaSample.point, bridges);
  if (!elevatedHit) return null;
  const maxAngle = (40 * Math.PI) / 180;
  let bestGround: { point: LngLatPair; score: number } | null = null;
  for (const ribbon of ribbons) {
    if (ribbon.elevated || !GROUND_CLASSES.has(ribbon.roadClass)) continue;
    const hit = closestPointOnLines(elevatedHit.point, [ribbon.line]);
    if (!hit) continue;
    if (!bearingsParallel(elevatedHit.bearing, hit.bearing, maxAngle)) continue;
    const gap = distanceMeters(elevatedHit.point, hit.point);
    if (gap < 12 || gap > 55) continue;
    const score = Math.abs(gap - 22);
    if (!bestGround || score < bestGround.score) bestGround = { point: hit.point, score };
  }
  if (!bestGround) return null;
  return { elevated: elevatedHit.point, ground: bestGround.point };
}
