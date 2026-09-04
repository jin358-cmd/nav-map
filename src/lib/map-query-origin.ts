import type { GpsStatus, LngLat, VehiclePose } from "@/types/domain";

export function isLiveGpsFix(gpsStatus: GpsStatus, vehicle: VehiclePose) {
  return gpsStatus === "active" && vehicle.source === "gps";
}

/**
 * Nearby queries (speed cameras, accidents, traffic ranking, search bias)
 * must not use the Tainan bootstrap / DEMO_VEHICLE pose.
 *
 * - Live GPS: query around the vehicle.
 * - User dragged the map: query the viewport they are looking at.
 * - Otherwise: no origin — skip location-based fetches and distance ranking.
 */
export function resolveMapQueryOrigin({
  gpsReady,
  vehicleLng,
  vehicleLat,
  viewportLng,
  viewportLat,
  userAdjustedMap,
}: {
  gpsReady: boolean;
  vehicleLng: number;
  vehicleLat: number;
  viewportLng: number | null;
  viewportLat: number | null;
  userAdjustedMap: boolean;
}): LngLat | null {
  if (userAdjustedMap && viewportLng != null && viewportLat != null) {
    return { lng: viewportLng, lat: viewportLat };
  }
  if (gpsReady) {
    return { lng: vehicleLng, lat: vehicleLat };
  }
  return null;
}
