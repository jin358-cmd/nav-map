/** Client-safe roadwork proximity and voice rules. No network, no invented coordinates. */

export const VERIFIED_ROADWORK_VOICE =
  "前方路段有已確認施工資訊，請留意現場指示。";

export const ROADWORK_VOICE_FORBIDDEN = ["正在施工", "道路封閉"];

const APPROACH_METERS = 400;

export function routeAvoidanceAuthorized() {
  return false;
}

function metersBetween(a, b) {
  const lat = ((a.lat + b.lat) / 2) * (Math.PI / 180);
  const kx = 111_320 * Math.cos(lat);
  const ky = 110_540;
  return Math.hypot((b.lng - a.lng) * kx, (b.lat - a.lat) * ky);
}

function pointToSegmentMeters(point, start, end) {
  const lat = ((start.lat + end.lat) / 2) * (Math.PI / 180);
  const kx = 111_320 * Math.cos(lat);
  const ky = 110_540;
  const ax = 0;
  const ay = 0;
  const bx = (end.lng - start.lng) * kx;
  const by = (end.lat - start.lat) * ky;
  const px = (point.lng - start.lng) * kx;
  const py = (point.lat - start.lat) * ky;
  const lengthSq = bx * bx + by * by;
  if (lengthSq === 0) return Math.hypot(px, py);
  const t = Math.max(0, Math.min(1, (px * bx + py * by) / lengthSq));
  return Math.hypot(px - bx * t, py - by * t);
}

export function geometryPoints(geometry) {
  if (!geometry || typeof geometry !== "object") return [];
  if (geometry.type === "Point" && Array.isArray(geometry.coordinates)) {
    const [lng, lat] = geometry.coordinates;
    return Number.isFinite(lng) && Number.isFinite(lat) ? [{ lng, lat }] : [];
  }
  if (geometry.type === "LineString" && Array.isArray(geometry.coordinates)) {
    return geometry.coordinates
      .filter((pair) => Array.isArray(pair) && pair.length >= 2)
      .map(([lng, lat]) => ({ lng, lat }))
      .filter((point) => Number.isFinite(point.lng) && Number.isFinite(point.lat));
  }
  return [];
}

export function distanceToGeometryMeters(origin, geometry) {
  const points = geometryPoints(geometry);
  if (!origin || points.length === 0) return Number.POSITIVE_INFINITY;
  if (points.length === 1) return metersBetween(origin, points[0]);
  let best = Number.POSITIVE_INFINITY;
  for (let index = 1; index < points.length; index += 1) {
    best = Math.min(best, pointToSegmentMeters(origin, points[index - 1], points[index]));
  }
  return best;
}

export function approachingVerifiedEvents(events, origin, thresholdMeters = APPROACH_METERS) {
  if (!origin) return [];
  return (events ?? [])
    .filter((event) => event?.voice_eligible && event?.map_visible && event?.geometry)
    .filter((event) => distanceToGeometryMeters(origin, event.geometry) <= thresholdMeters)
    .map((event) => event.id);
}

export function nextVoiceAlert(events, origin, alreadyAnnounced, thresholdMeters = APPROACH_METERS) {
  const announced = alreadyAnnounced instanceof Set ? alreadyAnnounced : new Set(alreadyAnnounced ?? []);
  return (
    approachingVerifiedEvents(events, origin, thresholdMeters).find((id) => !announced.has(id)) ??
    null
  );
}
