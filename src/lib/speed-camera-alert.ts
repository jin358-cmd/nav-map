import { bearingDegrees, distanceKm, headingDelta } from "@/lib/geo";
import type { LngLat, SpeedEnforcementPoint } from "@/types/domain";

export const SPEED_CAMERA_ALERT_METERS = 300;

export type SpeedCameraAlert = {
  id: string;
  speedLimitKph: number;
  distanceMeters: number;
};

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
      best = {
        id: point.id,
        speedLimitKph: Math.round(kph),
        distanceMeters: meters,
      };
    }
  }
  return best;
}
