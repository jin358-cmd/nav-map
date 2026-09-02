import {
  CITY_CCTV_MORE_LIMIT,
  CITY_CCTV_NEARBY_KM,
  CITY_CCTV_PREVIEW_LIMIT,
  CITY_CCTV_RADIUS_KM,
  CCTV_AHEAD_MAX_ANGLE,
  CCTV_MOVE_REFRESH_KM,
  CCTV_ZOOM_REFRESH_DELTA,
  FREEWAY_CCTV_RADIUS_KM,
} from "@/lib/cctv-constants";
import { bearingDegrees, distanceKm, headingDelta } from "@/lib/geo";
import {
  CCTV_ZOOM_COUNT,
  pickVisiblePoints,
  zoomVisibleLimit,
} from "@/lib/map-visibility";
import type { CctvCamera, LngLat, MapViewport } from "@/types/domain";

export function isCameraAhead(
  camera: CctvCamera,
  origin: LngLat,
  heading: number,
  maxAngle = CCTV_AHEAD_MAX_ANGLE,
): boolean {
  if (!Number.isFinite(heading)) return false;
  const bearing = bearingDegrees(origin, camera.location);
  return headingDelta(heading, bearing) <= maxAngle;
}

export function isCameraAlongRoute(
  camera: CctvCamera,
  route: [number, number][],
  vehicle: LngLat,
  thresholdKm = 0.08,
): boolean {
  if (route.length < 2) return false;
  let nearestVehicleIndex = 0;
  let nearestVehicleKm = Infinity;
  route.forEach((coord, index) => {
    const km = distanceKm(vehicle, { lng: coord[0], lat: coord[1] });
    if (km < nearestVehicleKm) {
      nearestVehicleKm = km;
      nearestVehicleIndex = index;
    }
  });

  return route.slice(nearestVehicleIndex).some((coord) => {
    return (
      distanceKm(camera.location, { lng: coord[0], lat: coord[1] }) <=
      thresholdKm
    );
  });
}

export function scoreCameras(
  cameras: CctvCamera[],
  origin: LngLat,
  heading: number,
  route: [number, number][],
): CctvCamera[] {
  return cameras
    .map((camera) => {
      const km = distanceKm(origin, camera.location);
      const nearbyLimit =
        camera.sourceType === "freeway"
          ? FREEWAY_CCTV_RADIUS_KM
          : CITY_CCTV_NEARBY_KM;
      return {
        ...camera,
        distanceKm: km,
        withinLocateRadius: km <= CITY_CCTV_RADIUS_KM,
        withinNearby: km <= nearbyLimit,
        ahead: isCameraAhead(camera, origin, heading),
        alongRoute: isCameraAlongRoute(camera, route, origin),
      };
    })
    .filter((camera) => Number.isFinite(camera.distanceKm))
    .sort((a, b) => {
      const aRank =
        Number(Boolean(a.alongRoute)) * 4 +
        Number(Boolean(a.ahead)) * 2 +
        Number(Boolean(a.withinLocateRadius));
      const bRank =
        Number(Boolean(b.alongRoute)) * 4 +
        Number(Boolean(b.ahead)) * 2 +
        Number(Boolean(b.withinLocateRadius));
      if (bRank !== aRank) return bRank - aRank;
      return (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity);
    });
}

export function nearbyCameras(scored: CctvCamera[]): CctvCamera[] {
  const nearby = scored.filter((camera) => camera.withinNearby);
  if (nearby.length) return nearby.slice(0, CITY_CCTV_MORE_LIMIT);
  return scored.slice(0, CITY_CCTV_PREVIEW_LIMIT).map((camera) => ({
    ...camera,
    snapshotLabel: `${camera.snapshotLabel} · 範圍外最近`,
  }));
}

export function previewCameras(scored: CctvCamera[]): CctvCamera[] {
  return nearbyCameras(scored).slice(0, CITY_CCTV_PREVIEW_LIMIT);
}

export function mapVisibleCameras(
  scored: CctvCamera[],
  viewport: MapViewport | null,
): CctvCamera[] {
  const zoom = viewport?.zoom ?? 16;
  const limit = zoomVisibleLimit(zoom, CCTV_ZOOM_COUNT);
  const nearby = nearbyCameras(scored);
  const picked = pickVisiblePoints(nearby, {
    location: (camera) => camera.location,
    viewport,
    limit,
    prefer: (camera) =>
      Boolean(
        camera.alongRoute || camera.ahead || camera.withinLocateRadius,
      ),
  });
  if (picked.length || !viewport) return picked;
  return nearby.slice(0, limit);
}

export function shouldRefreshCctvView(
  previous: {
    center: LngLat;
    zoom: number;
    at: number;
    hasViewport?: boolean;
  } | null,
  nextCenter: LngLat,
  nextZoom: number,
  force: boolean,
  cacheMs: number,
  hasViewport = false,
): boolean {
  if (force || !previous) return true;
  if (hasViewport && !previous.hasViewport) return true;
  if (Date.now() - previous.at > cacheMs) return true;
  if (distanceKm(previous.center, nextCenter) >= CCTV_MOVE_REFRESH_KM) {
    return true;
  }
  if (Math.abs(previous.zoom - nextZoom) >= CCTV_ZOOM_REFRESH_DELTA) {
    return true;
  }
  return false;
}
