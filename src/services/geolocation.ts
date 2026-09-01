import type { GpsStatus, VehiclePose } from "@/types/domain";

export type GeoWatchHandlers = {
  onFix: (pose: VehiclePose) => void;
  onStatus: (status: GpsStatus) => void;
};

function toHeading(value: number | null): number | null {
  if (value === null || Number.isNaN(value)) return null;
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

  const watchId = navigator.geolocation.watchPosition(
    (position) => {
      const heading = toHeading(position.coords.heading);
      onFix({
        lng: position.coords.longitude,
        lat: position.coords.latitude,
        heading: heading ?? 0,
        accuracy: position.coords.accuracy,
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
      maximumAge: 4_000,
      timeout: 12_000,
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
          source: "gps",
        });
      },
      (error) => reject(error),
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 2_000 },
    );
  });
}
