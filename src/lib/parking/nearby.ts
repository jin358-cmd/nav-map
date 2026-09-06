import "server-only";

import { distanceKm } from "@/lib/geo";
import {
  OSM_PARKING_SOURCE,
  PARKING_DEFAULT_RADIUS_M,
  PARKING_MAX_RADIUS_M,
  PARKING_MIN_RADIUS_M,
  TAIPEI_PARKING_SOURCE,
  TAINAN_PARKING_SOURCE,
  TDX_PARKING_SOURCE,
} from "@/lib/parking/constants";
import { mergeParkingLots } from "@/lib/parking/merge";
import { readParkingMemory } from "@/lib/parking/memory-store";
import { fetchOsmParkingLots } from "@/lib/parking/providers/osm";
import { fetchTaipeiParkingLots } from "@/lib/parking/providers/taipei";
import { fetchTdxParkingLots } from "@/lib/parking/providers/tdx";
import { queryNearbyParkingLots } from "@/lib/parking/repository";
import { parkingFillFromAvailability } from "@/lib/parking/schema";
import { syncTainanParking } from "@/lib/parking/sync";
import { isInTainan, parkingCitiesNear } from "@/lib/parking-cities";
import { isSupabaseConfigured } from "@/lib/supabase/server";
import type {
  DataFreshness,
  LngLat,
  ParkingCatalog,
  ParkingDataOrigin,
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

function originOf(source: string): ParkingDataOrigin {
  if (source === TDX_PARKING_SOURCE) return "tdx-live";
  if (source === TAIPEI_PARKING_SOURCE) return "taipei-open";
  if (source === OSM_PARKING_SOURCE) return "osm-open";
  return "tainan-open";
}

function sourceLabel(source: string) {
  if (source === TDX_PARKING_SOURCE) return "TDX 路外停車場";
  if (source === TAIPEI_PARKING_SOURCE) return "臺北市停管處 Open Data";
  if (source === OSM_PARKING_SOURCE) return "OpenStreetMap 停車場";
  if (source === TAINAN_PARKING_SOURCE) return "臺南市停車 Open Data";
  return source;
}

function catalogOrigin(lots: ParkingLot[]): ParkingDataOrigin {
  if (lots.some((lot) => lot.origin === "tainan-open")) return "tainan-open";
  if (lots.some((lot) => lot.origin === "taipei-open")) return "taipei-open";
  if (lots.some((lot) => lot.origin === "tdx-live")) return "tdx-live";
  if (lots.some((lot) => lot.origin === "osm-open")) return "osm-open";
  return "unavailable";
}

function toCatalogLot(
  lot: import("@/lib/parking/schema").NormalizedParkingLot,
  center: LngLat,
): ParkingLot {
  const distanceMeters = Math.round(
    distanceKm(center, { lat: lot.latitude, lng: lot.longitude }) * 1000,
  );
  const status = lot.availability.status;
  const origin = originOf(lot.source);
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
    brand: lot.brand,
    registered: lot.registered,
    hours: lot.operatingHours,
    updatedAt: lot.availability.dataTimestamp ?? undefined,
    availabilityStatus: status,
    source: sourceLabel(lot.source),
    origin,
    freshness: freshnessOf(status),
    fill: parkingFillFromAvailability(
      lot.availability.availableSpaces,
      lot.availability.totalSpaces ?? lot.carSpaces,
      status,
    ),
  };
}

async function loadTainanLots(center: LngLat, radius: number) {
  if (!isInTainan(center)) return [];
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
  return normalized;
}

export async function loadNearbyParkingLots(
  center: LngLat,
  radiusMeters = PARKING_DEFAULT_RADIUS_M,
): Promise<ParkingCatalog> {
  const radius = clampParkingRadius(radiusMeters);
  const cities = parkingCitiesNear(center, radius / 1000);
  const wantTaipei = cities.includes("Taipei");
  const [tainan, tdx, taipei, osm] = await Promise.all([
    loadTainanLots(center, radius),
    fetchTdxParkingLots(center, Math.max(radius / 1000, 6)),
    wantTaipei ? fetchTaipeiParkingLots() : Promise.resolve([]),
    fetchOsmParkingLots(center, radius),
  ]);

  const merged = mergeParkingLots([tainan, tdx, taipei, osm]).filter((lot) => {
    const meters =
      distanceKm(center, { lat: lot.latitude, lng: lot.longitude }) * 1000;
    return meters <= radius;
  });

  const lots = merged
    .map((lot) => toCatalogLot(lot, center))
    .sort((a, b) => (a.distanceMeters ?? 0) - (b.distanceMeters ?? 0));

  if (!lots.length) {
    return {
      origin: "unavailable",
      lots: [],
      fetchedAt: new Date().toISOString(),
    };
  }

  return {
    origin: catalogOrigin(lots),
    lots,
    fetchedAt: new Date().toISOString(),
  };
}
