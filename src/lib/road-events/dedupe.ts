import {
  bboxDiagonalMeters,
  geometryContains,
  haversineMeters,
  precisionRank,
  representativeLngLat,
} from "./geometry";
import type { NormalizedRoadEvent } from "./types";

const NEAR_METERS = 40;
const PERMIT_METERS = 200;
const SMALL_SITE_METERS = 300;

function permitKey(value: string | null) {
  if (!value) return "";
  const compact = value.replace(/[^0-9A-Za-z]/g, "").toUpperCase();
  return compact.length >= 6 ? compact : "";
}

function blob(event: NormalizedRoadEvent) {
  return [event.id, event.title, event.description, event.permitId]
    .filter(Boolean)
    .join(" ")
    .toUpperCase();
}

function sameWork(open: NormalizedRoadEvent, tdx: NormalizedRoadEvent) {
  if (!open.city || open.city !== tdx.city) return false;
  const openPoint = representativeLngLat(open.geometry);
  const tdxPoint = representativeLngLat(tdx.geometry);
  if (!openPoint || !tdxPoint) return false;
  const distance = haversineMeters(openPoint, tdxPoint);
  const openPermit = permitKey(open.permitId);
  const permitHit =
    Boolean(openPermit) &&
    (permitKey(tdx.permitId) === openPermit || blob(tdx).includes(openPermit));
  if (permitHit && distance <= PERMIT_METERS) return true;
  const openSpan = bboxDiagonalMeters(open.geometry);
  const tdxSpan = bboxDiagonalMeters(tdx.geometry);
  const small = openSpan <= SMALL_SITE_METERS && tdxSpan <= SMALL_SITE_METERS;
  if (!small) return false;
  if (distance <= NEAR_METERS) return true;
  if (open.geometry && geometryContains(open.geometry, tdxPoint)) return true;
  if (tdx.geometry && geometryContains(tdx.geometry, openPoint)) return true;
  return false;
}

function keepRicher(open: NormalizedRoadEvent, tdx: NormalizedRoadEvent) {
  const openRank = precisionRank(open.locationPrecision);
  const tdxRank = precisionRank(tdx.locationPrecision);
  return openRank > tdxRank ? open : tdx;
}

/**
 * Drop a city open-data construction row when it is the same work already
 * published by that city's TDX live feed (Taipei 道管中心 is the usual case).
 * The survivor keeps the more precise geometry.
 */
export function dedupeOpenDataAgainstTdx(events: NormalizedRoadEvent[]): {
  events: NormalizedRoadEvent[];
  removed: number;
} {
  const tdx = events.filter((event) => event.sourceDataset.startsWith("tdx:"));
  const open = events.filter((event) => event.sourceDataset.startsWith("open:"));
  const other = events.filter(
    (event) =>
      !event.sourceDataset.startsWith("tdx:") && !event.sourceDataset.startsWith("open:"),
  );
  const usedTdx = new Set<string>();
  const dropped = new Set<string>();
  const survivors = new Map<string, NormalizedRoadEvent>();

  for (const row of open) {
    let match: NormalizedRoadEvent | null = null;
    let bestDistance = Infinity;
    const origin = representativeLngLat(row.geometry);
    for (const candidate of tdx) {
      if (usedTdx.has(candidate.id) || !sameWork(row, candidate)) continue;
      const point = representativeLngLat(candidate.geometry);
      const distance = origin && point ? haversineMeters(origin, point) : Infinity;
      if (distance < bestDistance) {
        bestDistance = distance;
        match = candidate;
      }
    }
    if (!match) continue;
    usedTdx.add(match.id);
    const keeper = keepRicher(row, match);
    const removed = keeper.id === row.id ? match : row;
    dropped.add(removed.id);
    const existing = survivors.get(keeper.id) ?? keeper;
    survivors.set(keeper.id, {
      ...existing,
      dedupedWith: [...new Set([...existing.dedupedWith, removed.id])],
    });
  }

  const kept = [...tdx, ...open, ...other]
    .filter((event) => !dropped.has(event.id))
    .map((event) => survivors.get(event.id) ?? event);
  return { events: kept, removed: dropped.size };
}
