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

const subscribers = new Set<GeoWatchHandlers>();
let watchId: number | null = null;
let restartTimer = 0;
let teardownTimer = 0;
let lastFix: VehiclePose | null = null;
let lastHeading = 0;
let lastPoint: { lng: number; lat: number } | null = null;
let denied = false;

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

function emitStatus(status: GpsStatus) {
  for (const subscriber of subscribers) subscriber.onStatus(status);
}

function emitError(code: GpsErrorCode) {
  for (const subscriber of subscribers) subscriber.onError?.(code);
}

function emitPermission(state: GpsPermissionState) {
  for (const subscriber of subscribers) subscriber.onPermission?.(state);
}

function emitFix(pose: VehiclePose) {
  lastFix = pose;
  lastPoint = { lng: pose.lng, lat: pose.lat };
  lastHeading = pose.heading;
  denied = false;
  for (const subscriber of subscribers) subscriber.onFix(pose);
}

function applyPosition(position: GeolocationPosition) {
  const lng = position.coords.longitude;
  const lat = position.coords.latitude;
  const gpsHeading = toHeading(position.coords.heading);
  let heading = gpsHeading ?? lastHeading;

  if (lastPoint) {
    const movedKm = distanceKm(lastPoint, { lng, lat });
    const fromMove = bearingDegrees(lastPoint, { lng, lat });
    if (gpsHeading === null && movedKm > 0.004) {
      heading = fromMove;
    } else if (gpsHeading !== null && movedKm < 0.002) {
      heading = lastHeading;
    }
  }

  const pose = toPose(position, heading);
  emitFix(pose);
  emitStatus("active");
  emitPermission("granted");
  emitError(null);
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
  if (code === "timeout") return "定位逾時，請點右上定位鍵再試一次。";
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

function isAndroid() {
  return typeof navigator !== "undefined" && /Android/i.test(navigator.userAgent);
}

function clearWatch() {
  window.clearTimeout(restartTimer);
  if (watchId !== null && "geolocation" in navigator) {
    navigator.geolocation.clearWatch(watchId);
  }
  watchId = null;
}

let permissionBound = false;

function bindGeolocationPermission() {
  if (permissionBound || typeof navigator === "undefined" || !navigator.permissions?.query) {
    return;
  }
  permissionBound = true;
  void navigator.permissions
    .query({ name: "geolocation" })
    .then((result) => {
      result.addEventListener("change", () => {
        if (result.state === "granted") {
          denied = false;
          emitPermission("granted");
          if (subscribers.size > 0 && watchId === null) startWatch();
          return;
        }
        if (result.state === "denied") {
          denied = true;
          emitPermission("denied");
          emitStatus("denied");
          emitError("permission_denied");
          clearWatch();
          return;
        }
        emitPermission("prompt");
      });
    })
    .catch(() => {
      permissionBound = false;
    });
}

function startWatchIfAllowed(permission: GpsPermissionState) {
  if (subscribers.size === 0) return;
  if (permission === "denied") {
    denied = true;
    emitStatus("denied");
    emitError("permission_denied");
    return;
  }
  if (permission === "granted" || permission === "unsupported") {
    if (permission === "unsupported") {
      emitStatus("unavailable");
      emitError("unsupported");
      return;
    }
    startWatch();
    return;
  }
  // Android Chrome often returns PERMISSION_DENIED if watch starts without a tap.
  if (isAndroid()) {
    emitStatus("idle");
    return;
  }
  startWatch();
}

function startWatch() {
  if (typeof window === "undefined" || !("geolocation" in navigator)) {
    emitStatus("unavailable");
    emitError("unsupported");
    emitPermission("unsupported");
    return;
  }
  if (watchId !== null || denied) return;

  emitStatus(lastFix ? "active" : "locating");

  watchId = navigator.geolocation.watchPosition(
    (position) => {
      applyPosition(position);
    },
    (error) => {
      const code = geoErrorCode(error);
      emitError(code);
      if (code === "permission_denied") {
        denied = true;
        emitStatus("denied");
        emitPermission("denied");
        clearWatch();
        return;
      }
      if (code === "unsupported") {
        emitStatus("unavailable");
        emitPermission("unsupported");
        clearWatch();
        return;
      }
      if (!lastFix) emitStatus("unavailable");
      window.clearTimeout(restartTimer);
      restartTimer = window.setTimeout(() => {
        clearWatch();
        if (subscribers.size > 0 && !denied) startWatch();
      }, 1_600);
    },
    WATCH_OPTIONS,
  );
}

/** Browser GPS. Shared across React Strict Mode remounts. */
export function watchVehiclePosition(handlers: GeoWatchHandlers): () => void {
  window.clearTimeout(teardownTimer);
  subscribers.add(handlers);
  bindGeolocationPermission();
  const fresh =
    Boolean(lastFix?.fixedAt) && Date.now() - (lastFix?.fixedAt ?? 0) < 20_000;
  if (fresh && lastFix) {
    handlers.onFix(lastFix);
    handlers.onStatus("active");
    handlers.onPermission?.("granted");
    handlers.onError?.(null);
    if (!denied) startWatch();
  } else if (denied) {
    handlers.onStatus("denied");
    handlers.onPermission?.("denied");
    handlers.onError?.("permission_denied");
  } else {
    handlers.onStatus(isAndroid() ? "idle" : "locating");
    void queryGeolocationPermission().then((state) => {
      if (!subscribers.has(handlers)) return;
      emitPermission(state);
      startWatchIfAllowed(state);
    });
  }

  return () => {
    subscribers.delete(handlers);
    window.clearTimeout(teardownTimer);
    teardownTimer = window.setTimeout(() => {
      if (subscribers.size === 0) clearWatch();
    }, 800);
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
        denied = false;
        applyPosition(position);
        if (subscribers.size > 0 && watchId === null) startWatch();
        resolve(lastFix ?? toPose(position, lastHeading));
      },
      (error) => {
        const code = geoErrorCode(error);
        emitError(code);
        if (code === "permission_denied") {
          denied = true;
          emitStatus("denied");
          emitPermission("denied");
        } else if (!lastFix) {
          emitStatus("unavailable");
        }
        reject(error);
      },
      ONCE_OPTIONS,
    );
  });
}
