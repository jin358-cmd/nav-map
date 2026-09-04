import { bearingDegrees, distanceKm } from "@/lib/geo";
import type { GpsErrorCode, GpsPermissionState, GpsStatus, VehiclePose } from "@/types/domain";

export type GeoWatchHandlers = {
  onFix: (pose: VehiclePose) => void;
  onStatus: (status: GpsStatus) => void;
  onError?: (code: GpsErrorCode) => void;
  onPermission?: (state: GpsPermissionState) => void;
};

const WATCH_OPTIONS: PositionOptions = {
  enableHighAccuracy: true,
  maximumAge: 0,
  timeout: 25_000,
};

const ONCE_OPTIONS: PositionOptions = {
  enableHighAccuracy: true,
  maximumAge: 0,
  timeout: 20_000,
};

function toHeading(value: number | null): number | null {
  if (value === null || Number.isNaN(value)) return null;
  return (value + 360) % 360;
}

function toSpeed(value: number | null): number | undefined {
  if (value === null || !Number.isFinite(value) || value < 0) return undefined;
  return value;
}

function toPose(position: GeolocationPosition, heading: number): VehiclePose {
  return {
    lng: position.coords.longitude,
    lat: position.coords.latitude,
    heading,
    accuracy: position.coords.accuracy,
    speedMps: toSpeed(position.coords.speed),
    source: "gps",
    fixedAt: position.timestamp || Date.now(),
  };
}

export function geoErrorCode(error: unknown): GpsErrorCode {
  if (typeof error === "object" && error && "code" in error) {
    const code = (error as GeolocationPositionError).code;
    if (code === 1) return "permission_denied";
    if (code === 2) return "position_unavailable";
    if (code === 3) return "timeout";
  }
  if (error instanceof Error && error.message === "geolocation-unavailable") {
    return "unsupported";
  }
  return "position_unavailable";
}

export function geoErrorMessage(code: GpsErrorCode): string {
  if (code === "permission_denied") return "定位權限被拒，請在瀏覽器允許位置存取。";
  if (code === "timeout") return "定位逾時，請到空曠處再試一次。";
  if (code === "unsupported") return "此瀏覽器不支援定位。";
  return "目前無法取得位置。";
}

export async function queryGeolocationPermission(): Promise<GpsPermissionState> {
  if (typeof navigator === "undefined" || !("geolocation" in navigator)) {
    return "unsupported";
  }
  try {
    if (!navigator.permissions?.query) return "prompt";
    const result = await navigator.permissions.query({ name: "geolocation" });
    if (result.state === "granted" || result.state === "denied") return result.state;
    return "prompt";
  } catch {
    return "prompt";
  }
}

/** Browser GPS. Returns an unsubscribe function. */
export function watchVehiclePosition({
  onFix,
  onStatus,
  onError,
  onPermission,
}: GeoWatchHandlers): () => void {
  if (typeof window === "undefined" || !("geolocation" in navigator)) {
    onStatus("unavailable");
    onError?.("unsupported");
    onPermission?.("unsupported");
    return () => undefined;
  }

  let cancelled = false;
  let watchId: number | null = null;
  let restartTimer = 0;
  let last: { lng: number; lat: number; heading: number } | null = null;
  let hasFix = false;

  onStatus("locating");
  void queryGeolocationPermission().then((state) => {
    if (!cancelled) onPermission?.(state);
  });

  const start = () => {
    if (cancelled || !("geolocation" in navigator)) return;
    if (watchId !== null) {
      navigator.geolocation.clearWatch(watchId);
      watchId = null;
    }
    watchId = navigator.geolocation.watchPosition(
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
        hasFix = true;
        onFix(toPose(position, heading));
        onStatus("active");
        onPermission?.("granted");
        onError?.(null);
      },
      (error) => {
        const code = geoErrorCode(error);
        onError?.(code);
        if (code === "permission_denied") {
          onStatus("denied");
          onPermission?.("denied");
          return;
        }
        if (code === "unsupported") {
          onStatus("unavailable");
          onPermission?.("unsupported");
          return;
        }
        if (!hasFix) onStatus("unavailable");
        if (!cancelled) {
          window.clearTimeout(restartTimer);
          restartTimer = window.setTimeout(start, 1_600);
        }
      },
      WATCH_OPTIONS,
    );
  };

  start();

  return () => {
    cancelled = true;
    window.clearTimeout(restartTimer);
    if (watchId !== null) navigator.geolocation.clearWatch(watchId);
  };
}

export function requestCurrentPosition(): Promise<VehiclePose> {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined" || !("geolocation" in navigator)) {
      reject(new Error("geolocation-unavailable"));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve(
          toPose(position, toHeading(position.coords.heading) ?? 0),
        );
      },
      (error) => reject(error),
      ONCE_OPTIONS,
    );
  });
}
