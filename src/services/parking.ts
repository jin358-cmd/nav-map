import "server-only";

import { loadNearbyParkingLots } from "@/lib/parking/nearby";
import type { LngLat, ParkingCatalog } from "@/types/domain";

export async function loadNearbyParking(
  center: LngLat,
  radiusKm = 3,
): Promise<ParkingCatalog> {
  return loadNearbyParkingLots(center, Math.round(radiusKm * 1000));
}
