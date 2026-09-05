import type { LngLat } from "@/types/domain";

const EARTH_RADIUS_KM = 6371;

function toRadians(value: number) {
  return (value * Math.PI) / 180;
}

export function distanceKm(a: LngLat, b: LngLat): number {
  const dLat = toRadians(b.lat - a.lat);
  const dLng = toRadians(b.lng - a.lng);
  const sinLat = Math.sin(dLat / 2);
  const sinLng = Math.sin(dLng / 2);
  const h =
    sinLat * sinLat +
    Math.cos(toRadians(a.lat)) * Math.cos(toRadians(b.lat)) * sinLng * sinLng;
  return EARTH_RADIUS_KM * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

export function bearingDegrees(from: LngLat, to: LngLat): number {
  const y =
    Math.sin(toRadians(to.lng - from.lng)) * Math.cos(toRadians(to.lat));
  const x =
    Math.cos(toRadians(from.lat)) * Math.sin(toRadians(to.lat)) -
    Math.sin(toRadians(from.lat)) *
      Math.cos(toRadians(to.lat)) *
      Math.cos(toRadians(to.lng - from.lng));
  return (Math.atan2(y, x) * (180 / Math.PI) + 360) % 360;
}

export function headingDelta(a: number, b: number): number {
  const raw = Math.abs(((a - b + 540) % 360) - 180);
  return raw;
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** Shortest-arc interpolation, result in 0–360. */
export function lerpAngle(a: number, b: number, t: number): number {
  const delta = ((b - a + 540) % 360) - 180;
  return (a + delta * t + 360) % 360;
}

export function damp(dtSeconds: number, tau: number): number {
  return 1 - Math.exp(-dtSeconds / Math.max(tau, 0.016));
}

/** Destination from a point along a bearing. Presentation / cone geometry only. */
export function destinationPoint(
  from: LngLat,
  distanceMeters: number,
  bearingDeg: number,
): LngLat {
  const distRatio = distanceMeters / 1000 / EARTH_RADIUS_KM;
  const brng = toRadians(bearingDeg);
  const lat1 = toRadians(from.lat);
  const lng1 = toRadians(from.lng);
  const lat2 = Math.asin(
    Math.sin(lat1) * Math.cos(distRatio) +
      Math.cos(lat1) * Math.sin(distRatio) * Math.cos(brng),
  );
  const lng2 =
    lng1 +
    Math.atan2(
      Math.sin(brng) * Math.sin(distRatio) * Math.cos(lat1),
      Math.cos(distRatio) - Math.sin(lat1) * Math.sin(lat2),
    );
  return {
    lat: (lat2 * 180) / Math.PI,
    lng: (((lng2 * 180) / Math.PI + 540) % 360) - 180,
  };
}

export function isPointInBounds(
  point: LngLat,
  bounds: { west: number; south: number; east: number; north: number },
) {
  return (
    point.lng >= bounds.west &&
    point.lng <= bounds.east &&
    point.lat >= bounds.south &&
    point.lat <= bounds.north
  );
}
