import { LngLatBounds, type Map as MapLibreMap, type PaddingOptions } from "maplibre-gl";
import type { CameraMode } from "@/types/domain";

const TAIWAN_WEST = 118;
const TAIWAN_EAST = 123;
const TAIWAN_SOUTH = 20;
const TAIWAN_NORTH = 26.5;
const MAX_OVERVIEW_ZOOM = 16.2;
const MIN_SAFE_ZOOM = 8.6;
/** Modest 3D tilt so the whole start→end path stays in frame. */
export const ROUTE_OVERVIEW_3D_PITCH = 34;

function inTaiwan(lng: number, lat: number) {
  return (
    lng >= TAIWAN_WEST &&
    lng <= TAIWAN_EAST &&
    lat >= TAIWAN_SOUTH &&
    lat <= TAIWAN_NORTH
  );
}

export function taiwanRouteBounds(route: [number, number][]): LngLatBounds | null {
  if (route.length < 2) return null;
  const filtered = route.filter(([lng, lat]) => inTaiwan(lng, lat));
  const pts = filtered.length >= 2 ? filtered : route;
  const bounds = new LngLatBounds(pts[0], pts[0]);
  for (let i = 1; i < pts.length; i += 1) bounds.extend(pts[i]);
  return bounds;
}

export function minOverviewZoom(bounds: LngLatBounds): number {
  const sw = bounds.getSouthWest();
  const ne = bounds.getNorthEast();
  const span = Math.max(Math.abs(ne.lat - sw.lat), Math.abs(ne.lng - sw.lng));
  if (span < 0.004) return 15.6;
  if (span < 0.015) return 14.4;
  if (span < 0.05) return 13.0;
  if (span < 0.15) return 11.6;
  if (span < 0.4) return 10.4;
  if (span < 0.9) return 9.4;
  return MIN_SAFE_ZOOM;
}

export function easeToRouteOverview(
  map: MapLibreMap,
  route: [number, number][],
  cameraMode: CameraMode,
  padding: PaddingOptions,
): boolean {
  const bounds = taiwanRouteBounds(route);
  if (!bounds) return false;
  const floor = minOverviewZoom(bounds);
  const saved = {
    center: map.getCenter(),
    zoom: map.getZoom(),
    pitch: map.getPitch(),
    bearing: map.getBearing(),
  };
  let camera: ReturnType<MapLibreMap["cameraForBounds"]>;
  try {
    if (saved.pitch > 1) {
      map.jumpTo({ pitch: 0, bearing: 0 });
    }
    camera = map.cameraForBounds(bounds, {
      padding,
      bearing: 0,
      maxZoom: MAX_OVERVIEW_ZOOM,
    });
  } catch {
    camera = undefined;
  } finally {
    if (saved.pitch > 1) {
      try {
        map.jumpTo(saved);
      } catch {
        /* keep the computed camera even if restore fails */
      }
    }
  }
  const zoom = Math.min(
    MAX_OVERVIEW_ZOOM,
    Math.max(floor, camera?.zoom ?? floor, MIN_SAFE_ZOOM),
  );
  const center = camera?.center ?? bounds.getCenter();
  map.easeTo({
    center,
    zoom,
    bearing: 0,
    pitch: cameraMode === "3d" ? ROUTE_OVERVIEW_3D_PITCH : 0,
    duration: 520,
    essential: true,
  });
  return true;
}
