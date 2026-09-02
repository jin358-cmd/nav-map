import { bearingDegrees, distanceKm } from "@/lib/geo";
import type { GpsStatus, VehiclePose } from "@/types/domain";

export type GeoWatchHandlers = {
  onFix: (pose: VehiclePose) => void;
  onStatus: (status: GpsStatus) => void;
};

function toHeading(value: number | null): number | null {
  if (value === null || Number.isNaN(value)) return null;
  return (value + 360) % 360;
}

function toSpeed(value: number | null): number | undefined {
  if (value === null || !Number.isFinite(value) || value < 0) return undefined;
  return value;
}

/** Browser GPS. Returns an unsubscribe function. */
export function watchVehiclePosition({
  onFix,
  onStatus,
}: GeoWatchHandlers): () => void {
  if (typeof window === "undefined" || !("geolocation" in navigator)) {
    onStatus("unavailable");
    return () => undefined;
  }

  onStatus("locating");

  let last: { lng: number; lat: number; heading: number } | null = null;

  const watchId = navigator.geolocation.watchPosition(
    (position) => {
      const lng = position.coords.longitude;
      const lat = position.coords.latitude;
      const gpsHeading = toHeading(position.coords.heading);
      let heading = gpsHeading ?? last?.heading ?? 0;

      if (last) {
        const movedKm = distanceKm(last, { lng, lat });
        const fromMove = bearingDegrees(last, { lng, lat });
        if (gpsHeading === null && movedKm > 0.004) {
          heading = fromMove;
        } else if (gpsHeading !== null && movedKm < 0.002) {
          heading = last.heading;
        }
      }

      last = { lng, lat, heading };
      onFix({
        lng,
        lat,
        heading,
        accuracy: position.coords.accuracy,
        speedMps: toSpeed(position.coords.speed),
        source: "gps",
      });
      onStatus("active");
    },
    (error) => {
      if (error.code === error.PERMISSION_DENIED) {
        onStatus("denied");
        return;
      }
      onStatus("unavailable");
    },
    {
      enableHighAccuracy: true,
      maximumAge: 400,
      timeout: 10_000,
    },
  );

  return () => navigator.geolocation.clearWatch(watchId);
}

export function requestCurrentPosition(): Promise<VehiclePose> {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined" || !("geolocation" in navigator)) {
      reject(new Error("geolocation-unavailable"));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          lng: position.coords.longitude,
          lat: position.coords.latitude,
          heading: position.coords.heading ?? 0,
          accuracy: position.coords.accuracy,
          speedMps: toSpeed(position.coords.speed),
          source: "gps",
        });
      },
      (error) => reject(error),
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 800 },
    );
  });
}
