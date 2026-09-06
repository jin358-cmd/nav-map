import "server-only";

import { distanceKm } from "@/lib/geo";
import { inferPublicLot, matchParkingBrand } from "@/lib/parking/brands";
import {
  PARKING_AVAIL_SYNC_MS,
  PARKING_LOT_SYNC_MS,
} from "@/lib/parking/constants";
import { readParkingMemory } from "@/lib/parking/memory-store";
import type { NormalizedParkingLot, ParkingSyncResult } from "@/lib/parking/schema";
import { supabaseRest } from "@/lib/supabase/server";
import type { LngLat } from "@/types/domain";

type NearbyRow = {
  id: string;
  source: string;
  source_parking_id: string;
  name: string;
  address?: string | null;
  latitude: number;
  longitude: number;
  total_spaces?: number | null;
  car_spaces?: number | null;
  motorcycle_spaces?: number | null;
  disabled_spaces?: number | null;
  operating_hours?: string | null;
  phone?: string | null;
  operator?: string | null;
  city?: string | null;
  district?: string | null;
  is_active?: boolean;
  updated_at?: string | null;
  distance_meters?: number | null;
  available_spaces?: number | null;
  availability_total?: number | null;
  occupancy_rate?: number | null;
  data_timestamp?: string | null;
  fetched_at?: string | null;
  availability_status?: string | null;
  status?: string | null;
  parking_lot_id?: string;
  vehicle_type?: string | null;
  rate_type?: string | null;
  hourly_rate?: number | string | null;
  daily_max?: number | string | null;
  rate_description?: string | null;
};

function chunk<T>(items: T[], size: number) {
  const pages: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    pages.push(items.slice(index, index + size));
  }
  return pages;
}

function asNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

export async function upsertParkingSnapshot(
  lots: NormalizedParkingLot[],
): Promise<{ written: number; failed: number }> {
  let written = 0;
  let failed = 0;
  for (const page of chunk(lots, 80)) {
    const lotRows = page.map((lot) => ({
      id: lot.id,
      source: lot.source,
      source_parking_id: lot.sourceParkingId,
      name: lot.name,
      address: lot.address || null,
      latitude: lot.latitude,
      longitude: lot.longitude,
      total_spaces: lot.totalSpaces,
      car_spaces: lot.carSpaces,
      motorcycle_spaces: lot.motorcycleSpaces,
      disabled_spaces: lot.disabledSpaces,
      operating_hours: lot.operatingHours || null,
      phone: lot.phone || null,
      operator: lot.operator || null,
      city: lot.city,
      district: lot.district || null,
      is_active: lot.isActive,
    }));
    const lotResult = await supabaseRest("/rest/v1/parking_lots?on_conflict=id", {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
      body: JSON.stringify(lotRows),
    });
    if (lotResult.ok) written += page.length;
    else failed += page.length;

    const availRows = page.map((lot) => ({
      parking_lot_id: lot.id,
      available_spaces: lot.availability.availableSpaces,
      total_spaces: lot.availability.totalSpaces,
      occupancy_rate: lot.availability.occupancyRate,
      data_timestamp: lot.availability.dataTimestamp,
      fetched_at: new Date().toISOString(),
      status: lot.availability.status,
    }));
    await supabaseRest(
      "/rest/v1/parking_availability?on_conflict=parking_lot_id",
      {
        method: "POST",
        headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
        body: JSON.stringify(availRows),
      },
    );

    const rateRows = page.map((lot) => ({
      parking_lot_id: lot.id,
      vehicle_type: lot.rate.vehicleType,
      rate_type: lot.rate.rateType,
      hourly_rate: lot.rate.hourlyRate,
      daily_max: lot.rate.dailyMax,
      rate_description: lot.rate.description || null,
      updated_at: new Date().toISOString(),
    }));
    await supabaseRest(
      "/rest/v1/parking_rates?on_conflict=parking_lot_id,vehicle_type,rate_type",
      {
        method: "POST",
        headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
        body: JSON.stringify(rateRows),
      },
    );
  }
  return { written, failed };
}

export async function writeParkingSyncLog(result: ParkingSyncResult) {
  await supabaseRest("/rest/v1/parking_sync_logs", {
    method: "POST",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({
      source: result.source,
      started_at: result.startedAt,
      completed_at: result.completedAt,
      fetched_records: result.fetchedRecords,
      inserted_records: result.insertedRecords,
      updated_records: result.updatedRecords,
      failed_records: result.failedRecords,
      status: result.status,
      error_message: result.errorMessage,
    }),
  });
}

export function shouldSyncParking(source: string) {
  const memory = readParkingMemory(source);
  if (!memory) return { lots: true, availability: true };
  return {
    lots: Date.now() - memory.lotSyncedAt > PARKING_LOT_SYNC_MS,
    availability: Date.now() - memory.availSyncedAt > PARKING_AVAIL_SYNC_MS,
  };
}

function rowToNormalized(row: NearbyRow): NormalizedParkingLot {
  const hourlyRate = asNumber(row.hourly_rate);
  const dailyMax = asNumber(row.daily_max);
  const available = asNumber(row.available_spaces);
  const total = asNumber(row.availability_total ?? row.car_spaces ?? row.total_spaces);
  const status =
    row.availability_status === "available" ||
    row.availability_status === "full" ||
    row.availability_status === "stale" ||
    row.availability_status === "unknown"
      ? row.availability_status
      : "unknown";
  const description = row.rate_description ?? "";
  return {
    id: row.id,
    source: row.source,
    sourceParkingId: row.source_parking_id,
    name: row.name,
    address: row.address ?? "",
    latitude: row.latitude,
    longitude: row.longitude,
    totalSpaces: asNumber(row.total_spaces),
    carSpaces: asNumber(row.car_spaces),
    motorcycleSpaces: asNumber(row.motorcycle_spaces),
    disabledSpaces: asNumber(row.disabled_spaces),
    operatingHours: row.operating_hours ?? "",
    phone: row.phone ?? "",
    operator: row.operator ?? "",
    brand: matchParkingBrand(row.name, row.operator),
    city: row.city ?? "",
    district: row.district ?? "",
    isActive: row.is_active !== false,
    publicLot: inferPublicLot({
      name: row.name,
      operator: row.operator ?? "",
      typeName: row.operator ?? "",
    }),
    registered: true,
    feeClass:
      row.rate_type === "free"
        ? "free"
        : hourlyRate != null || /元|收費/.test(description)
          ? "paid"
          : "unknown",
    availability: {
      availableSpaces: available,
      totalSpaces: total,
      occupancyRate: asNumber(row.occupancy_rate),
      dataTimestamp: row.data_timestamp ?? row.fetched_at ?? null,
      status,
    },
    rate: {
      vehicleType: row.vehicle_type === "motorcycle" ? "motorcycle" : "car",
      rateType:
        row.rate_type === "hourly" ||
        row.rate_type === "daily" ||
        row.rate_type === "free"
          ? row.rate_type
          : "unknown",
      hourlyRate,
      dailyMax,
      description,
    },
  };
}

export async function queryNearbyParkingLots(
  center: LngLat,
  radiusMeters: number,
): Promise<NormalizedParkingLot[]> {
  const rpc = await supabaseRest<NearbyRow[]>(
    "/rest/v1/rpc/search_nearby_parking_lots",
    {
      method: "POST",
      body: JSON.stringify({
        center_lng: center.lng,
        center_lat: center.lat,
        radius_meters: radiusMeters,
        max_results: 80,
      }),
    },
  );
  if (rpc.ok && Array.isArray(rpc.data) && rpc.data.length) {
    return rpc.data.map(rowToNormalized);
  }

  const padLat = radiusMeters / 111_000;
  const padLng =
    radiusMeters / (111_000 * Math.max(Math.cos((center.lat * Math.PI) / 180), 0.2));
  const params = new URLSearchParams({
    select:
      "id,source,source_parking_id,name,address,latitude,longitude,total_spaces,car_spaces,motorcycle_spaces,disabled_spaces,operating_hours,phone,operator,city,district,is_active,updated_at",
    is_active: "eq.true",
    latitude: `gte.${center.lat - padLat}`,
    longitude: `gte.${center.lng - padLng}`,
    limit: "120",
  });
  const lots = await supabaseRest<NearbyRow[]>(
    `/rest/v1/parking_lots?${params}&latitude=lte.${center.lat + padLat}&longitude=lte.${center.lng + padLng}`,
  );
  if (!lots.ok || !lots.data?.length) return [];

  const ids = lots.data.map((row) => row.id);
  const inFilter = ids.map((id) => `"${id}"`).join(",");
  const [avail, rates] = await Promise.all([
    supabaseRest<NearbyRow[]>(
      `/rest/v1/parking_availability?parking_lot_id=in.(${inFilter})&select=parking_lot_id,available_spaces,total_spaces,occupancy_rate,data_timestamp,fetched_at,status`,
    ),
    supabaseRest<NearbyRow[]>(
      `/rest/v1/parking_rates?parking_lot_id=in.(${inFilter})&select=parking_lot_id,vehicle_type,rate_type,hourly_rate,daily_max,rate_description`,
    ),
  ]);
  const availById = new Map(
    (avail.data ?? []).map((row) => [
      (row as NearbyRow & { parking_lot_id?: string }).parking_lot_id ?? row.id,
      row,
    ]),
  );
  const rateById = new Map(
    (rates.data ?? []).map((row) => [
      (row as NearbyRow & { parking_lot_id?: string }).parking_lot_id ?? row.id,
      row,
    ]),
  );

  return lots.data
    .map((row) => {
      const live = availById.get(row.id);
      const rate = rateById.get(row.id);
      return rowToNormalized({
        ...row,
        available_spaces: live?.available_spaces ?? null,
        availability_total: live?.total_spaces ?? row.car_spaces,
        occupancy_rate: live?.occupancy_rate ?? null,
        data_timestamp: live?.data_timestamp ?? null,
        fetched_at: live?.fetched_at ?? row.updated_at,
        availability_status: live?.availability_status ?? live?.status ?? "unknown",
        vehicle_type: rate?.vehicle_type ?? "car",
        rate_type: rate?.rate_type ?? "unknown",
        hourly_rate: rate?.hourly_rate ?? null,
        daily_max: rate?.daily_max ?? null,
        rate_description: rate?.rate_description ?? null,
        distance_meters: distanceKm(center, {
          lat: row.latitude,
          lng: row.longitude,
        }) * 1000,
      });
    })
    .filter((lot) => {
      const meters =
        distanceKm(center, { lat: lot.latitude, lng: lot.longitude }) * 1000;
      return meters <= radiusMeters;
    });
}
