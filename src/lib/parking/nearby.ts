import "server-only";

import { distanceKm } from "@/lib/geo";
import {
  PARKING_DEFAULT_RADIUS_M,
  PARKING_MAX_RADIUS_M,
  PARKING_MIN_RADIUS_M,
  TAINAN_PARKING_SOURCE,
} from "@/lib/parking/constants";
import { readParkingMemory } from "@/lib/parking/memory-store";
import { queryNearbyParkingLots } from "@/lib/parking/repository";
import { parkingFillFromAvailability } from "@/lib/parking/schema";
import { syncTainanParking } from "@/lib/parking/sync";
import { isSupabaseConfigured } from "@/lib/supabase/server";
import type {
  DataFreshness,
  LngLat,
  ParkingCatalog,
  ParkingLot,
} from "@/types/domain";

export function clampParkingRadius(radiusMeters: number) {
  if (!Number.isFinite(radiusMeters)) return PARKING_DEFAULT_RADIUS_M;
  return Math.min(Math.max(radiusMeters, PARKING_MIN_RADIUS_M), PARKING_MAX_RADIUS_M);
}

function freshnessOf(status: ParkingLot["availabilityStatus"]): DataFreshness {
  if (status === "stale") return "stale";
  if (status === "unknown") return "unavailable";
  return "live";
}

function toCatalogLot(
  lot: import("@/lib/parking/schema").NormalizedParkingLot,
  center: LngLat,
): ParkingLot {
  const distanceMeters = Math.round(
    distanceKm(center, { lat: lot.latitude, lng: lot.longitude }) * 1000,
  );
  const status = lot.availability.status;
  return {
    id: lot.id,
    name: lot.name,
    address: lot.address,
    location: { lat: lot.latitude, lng: lot.longitude },
    distanceMeters,
    carAvailable: lot.availability.availableSpaces,
    carTotal: lot.availability.totalSpaces ?? lot.carSpaces,
    motorcycleAvailable: null,
    motorcycleTotal: lot.motorcycleSpaces,
    fee: lot.rate.description,
    feeClass: lot.feeClass,
    hourlyRate: lot.rate.hourlyRate,
    dailyMax: lot.rate.dailyMax,
    publicLot: lot.publicLot,
    registered: lot.registered,
    hours: lot.operatingHours,
    updatedAt: lot.availability.dataTimestamp ?? undefined,
    availabilityStatus: status,
    source: lot.source === TAINAN_PARKING_SOURCE ? "臺南市停車 Open Data" : lot.source,
    origin: "tainan-open",
    freshness: freshnessOf(status),
    fill: parkingFillFromAvailability(
      lot.availability.availableSpaces,
      lot.availability.totalSpaces ?? lot.carSpaces,
      status,
    ),
  };
}

export async function loadNearbyParkingLots(
  center: LngLat,
  radiusMeters = PARKING_DEFAULT_RADIUS_M,
): Promise<ParkingCatalog> {
  const radius = clampParkingRadius(radiusMeters);
  const sync = await syncTainanParking(false);
  let normalized = isSupabaseConfigured()
    ? await queryNearbyParkingLots(center, radius)
    : [];
  if (!normalized.length) {
    const memory = readParkingMemory(TAINAN_PARKING_SOURCE)?.lots ?? sync.lots;
    normalized = memory.filter((lot) => {
      const meters =
        distanceKm(center, { lat: lot.latitude, lng: lot.longitude }) * 1000;
      return meters <= radius;
    });
  }

  const lots = normalized
    .map((lot) => toCatalogLot(lot, center))
    .sort((a, b) => (a.distanceMeters ?? 0) - (b.distanceMeters ?? 0));

  if (!lots.length && sync.status === "failed" && !sync.lots.length) {
    return {
      origin: "unavailable",
      lots: [],
      fetchedAt: sync.completedAt,
    };
  }

  return {
    origin: lots.length ? "tainan-open" : "unavailable",
    lots,
    fetchedAt: sync.completedAt,
  };
}
