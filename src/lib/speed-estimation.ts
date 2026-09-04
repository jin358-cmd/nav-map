export type SpeedSample = {
  speedMps?: number;
  lng: number;
  lat: number;
  accuracy?: number;
  fixedAt?: number;
};

const MAX_KMH = 160;
const STALE_MS = 8_000;
const POOR_ACCURACY_M = 45;

export function speedMpsToKmh(speedMps?: number) {
  if (speedMps == null || !Number.isFinite(speedMps) || speedMps < 0) return null;
  const kmh = speedMps * 3.6;
  if (kmh > MAX_KMH) return null;
  return kmh;
}

export function fallbackSpeedKmh(
  previous: SpeedSample | null,
  current: SpeedSample,
) {
  if (!previous?.fixedAt || !current.fixedAt) return null;
  const dt = (current.fixedAt - previous.fixedAt) / 1000;
  if (dt < 0.4 || dt > 6) return null;
  const meters = haversineMeters(previous, current);
  const kmh = (meters / dt) * 3.6;
  if (!Number.isFinite(kmh) || kmh < 0 || kmh > MAX_KMH) return null;
  return kmh;
}

function haversineMeters(a: SpeedSample, b: SpeedSample) {
  const toRad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * toRad;
  const dLng = (b.lng - a.lng) * toRad;
  const lat1 = a.lat * toRad;
  const lat2 = b.lat * toRad;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 6371000 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

export function smoothSpeedKmh(previous: number | null, next: number | null) {
  if (next == null) return previous == null ? null : previous * 0.72;
  if (previous == null) return next;
  const alpha = next < 3 ? 0.45 : 0.28;
  const mixed = previous + (next - previous) * alpha;
  return mixed < 0.8 ? 0 : mixed;
}

export function readableGpsSpeedKmh(sample: SpeedSample, previous: SpeedSample | null) {
  const stale = !sample.fixedAt || Date.now() - sample.fixedAt > STALE_MS;
  const poor =
    typeof sample.accuracy === "number" && sample.accuracy > POOR_ACCURACY_M;
  if (stale || poor) return null;
  return speedMpsToKmh(sample.speedMps) ?? fallbackSpeedKmh(previous, sample);
}
