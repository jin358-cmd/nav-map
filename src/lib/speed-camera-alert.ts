import { bearingDegrees, distanceKm, headingDelta } from "@/lib/geo";
import type { LngLat, SpeedEnforcementPoint } from "@/types/domain";

export const SPEED_CAMERA_ALERT_METERS = 300;
export const SPEED_CAMERA_WARN_METERS = 150;
export const SPEED_CAMERA_URGENT_METERS = 50;

export type SpeedCameraCautionPhase = 300 | 150 | 50;

export type SpeedCameraAlert = {
  id: string;
  speedLimitKph: number;
  distanceMeters: number;
  phase: SpeedCameraCautionPhase;
};

export function speedCameraCautionPhase(
  meters: number,
): SpeedCameraCautionPhase | null {
  if (!Number.isFinite(meters) || meters > SPEED_CAMERA_ALERT_METERS) return null;
  if (meters > SPEED_CAMERA_WARN_METERS) return 300;
  if (meters > SPEED_CAMERA_URGENT_METERS) return 150;
  return 50;
}

export function approachingSpeedCameraLimit(
  origin: LngLat & { heading?: number },
  points: SpeedEnforcementPoint[],
): SpeedCameraAlert | null {
  let best: SpeedCameraAlert | null = null;
  const heading = Number.isFinite(origin.heading) ? origin.heading : null;

  for (const point of points) {
    const kph = point.speedLimit;
    if (kph == null || !Number.isFinite(kph) || kph <= 0 || kph > 140) continue;
    const meters = distanceKm(origin, point.location) * 1000;
    if (meters > SPEED_CAMERA_ALERT_METERS) continue;
    if (heading != null) {
      const bearing = bearingDegrees(origin, point.location);
      if (headingDelta(heading, bearing) > 95) continue;
    }
    if (!best || meters < best.distanceMeters) {
      const phase = speedCameraCautionPhase(meters);
      if (!phase) continue;
      best = {
        id: point.id,
        speedLimitKph: Math.round(kph),
        distanceMeters: meters,
        phase,
      };
    }
  }
  return best;
}
