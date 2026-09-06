import "server-only";

import { inferPublicLot, matchParkingBrand } from "@/lib/parking/brands";
import { TDX_PARKING_SOURCE } from "@/lib/parking/constants";
import { parkingCitiesNear } from "@/lib/parking-cities";
import { classifyParkingFee, chargeTypesOf } from "@/lib/parking-meta";
import {
  parkingAvailabilityStatus,
  parkingNameOf,
  parkingNumber,
  parkingPointOf,
  parkingRateType,
  parkingSpaceCount,
  parkingText,
  parseDailyMax,
  parseHourlyRate,
} from "@/lib/parking/parse";
import type { NormalizedParkingLot } from "@/lib/parking/schema";
import type { ParkingProvider } from "@/lib/parking/providers/types";
import {
  fetchCityParkingAvailability,
  fetchCityParkingLots,
  fetchCityParkingOperators,
  isTdxConfigured,
} from "@/services/tdx-client";
import type { LngLat } from "@/types/domain";

const LOTS_CACHE_MS = 15 * 60 * 1000;
const AVAIL_CACHE_MS = 90 * 1000;

type CachedRows = {
  rows: Record<string, unknown>[];
  expiresAt: number;
};

const lotsCache = new Map<string, CachedRows>();
const availCache = new Map<string, CachedRows>();
const operatorCache = new Map<string, CachedRows>();

const CAR_SPACE = new Set([0, 1, 7, 8, 9, 11, 15, 17, 19, 21, 23]);
const MOTO_SPACE = new Set([2, 3, 10, 12, 14, 16, 18, 20, 22]);

async function cachedCityRows(
  cache: Map<string, CachedRows>,
  key: string,
  ttlMs: number,
  load: () => Promise<Record<string, unknown>[]>,
) {
  const hit = cache.get(key);
  if (hit && hit.expiresAt > Date.now()) return hit.rows;
  const rows = await load();
  cache.set(key, { rows, expiresAt: Date.now() + ttlMs });
  return rows;
}

function spacesFromAvailabilities(list: unknown) {
  let carAvailable: number | null = null;
  let carTotal: number | null = null;
  let motorcycleAvailable: number | null = null;
  let motorcycleTotal: number | null = null;
  if (!Array.isArray(list)) {
    return { carAvailable, carTotal, motorcycleAvailable, motorcycleTotal };
  }
  for (const item of list) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    const type = parkingNumber(row.SpaceType);
    const available = parkingSpaceCount(parkingNumber(row.AvailableSpaces));
    const total = parkingSpaceCount(parkingNumber(row.NumberOfSpaces));
    if (type != null && CAR_SPACE.has(type)) {
      carAvailable = (carAvailable ?? 0) + (available ?? 0);
      carTotal = (carTotal ?? 0) + (total ?? 0);
    }
    if (type != null && MOTO_SPACE.has(type)) {
      motorcycleAvailable = (motorcycleAvailable ?? 0) + (available ?? 0);
      motorcycleTotal = (motorcycleTotal ?? 0) + (total ?? 0);
    }
  }
  return { carAvailable, carTotal, motorcycleAvailable, motorcycleTotal };
}

function toLot(
  row: Record<string, unknown>,
  live: Record<string, unknown> | undefined,
  operatorName: string,
  cityLabel: string,
): NormalizedParkingLot | null {
  const location = parkingPointOf(row);
  if (!location) return null;
  const sourceParkingId = parkingText(row.CarParkID);
  if (!sourceParkingId) return null;
  const name =
    parkingNameOf(row.CarParkName) || parkingNameOf(live?.CarParkName) || "停車場";
  const operator = operatorName || parkingText(row.OperatorID);
  const brand = matchParkingBrand(name, operator);
  const fee = parkingText(row.FareDescription) || parkingText(row.Description);
  const feeClass = classifyParkingFee(fee, chargeTypesOf(row.ChargeTypes));
  const typed = spacesFromAvailabilities(live?.Availabilities);
  const total = parkingSpaceCount(
    parkingNumber(live?.TotalSpaces) ?? parkingNumber(row.TotalSpaces),
  );
  const available = parkingSpaceCount(parkingNumber(live?.AvailableSpaces));
  const carAvailable = typed.carAvailable ?? available;
  const carTotal = typed.carTotal ?? total;
  const dataTimestamp =
    parkingText(live?.DataCollectTime) || parkingText(row.UpdateTime) || null;
  const hourlyRate = feeClass === "free" ? 0 : parseHourlyRate(fee);
  const occupancyRate =
    carAvailable != null && carTotal && carTotal > 0
      ? Number(((carTotal - carAvailable) / carTotal).toFixed(4))
      : null;

  return {
    id: `${TDX_PARKING_SOURCE}:${sourceParkingId}`,
    source: TDX_PARKING_SOURCE,
    sourceParkingId,
    name,
    address: parkingText(row.Address),
    latitude: location.lat,
    longitude: location.lng,
    totalSpaces: carTotal,
    carSpaces: carTotal,
    motorcycleSpaces: typed.motorcycleTotal,
    disabledSpaces: null,
    operatingHours:
      parkingText(row.ServiceTime) || parkingText(row.BusinessHours),
    phone: parkingText(row.Telephone),
    operator,
    brand,
    city: parkingText(row.City) || cityLabel,
    district: parkingText(row.TownName),
    isActive: true,
    publicLot: inferPublicLot({
      isPublic: row.IsPublic,
      operationType: row.OperationType,
      name,
      operator,
      brand,
    }),
    registered: true,
    feeClass,
    availability: {
      availableSpaces: carAvailable,
      totalSpaces: carTotal,
      occupancyRate,
      dataTimestamp,
      status: parkingAvailabilityStatus(carAvailable, dataTimestamp),
    },
    rate: {
      vehicleType: /機車/.test(name) ? "motorcycle" : "car",
      rateType: parkingRateType(feeClass, hourlyRate),
      hourlyRate,
      dailyMax: parseDailyMax(fee),
      description: fee,
    },
  };
}

export async function fetchTdxParkingLots(
  center: LngLat,
  radiusKm = 8,
): Promise<NormalizedParkingLot[]> {
  if (!isTdxConfigured()) return [];
  const cities = parkingCitiesNear(center, Math.max(radiusKm, 8));
  try {
    const pages = await Promise.all(
      cities.map(async (city) => {
        const [lots, availability, operators] = await Promise.all([
          cachedCityRows(lotsCache, city, LOTS_CACHE_MS, () =>
            fetchCityParkingLots(city),
          ),
          cachedCityRows(availCache, `avail-${city}`, AVAIL_CACHE_MS, () =>
            fetchCityParkingAvailability(city),
          ).catch(() => [] as Record<string, unknown>[]),
          cachedCityRows(operatorCache, `op-${city}`, LOTS_CACHE_MS, () =>
            fetchCityParkingOperators(city),
          ).catch(() => [] as Record<string, unknown>[]),
        ]);
        return { city, lots, availability, operators };
      }),
    );
    const live = new Map<string, Record<string, unknown>>();
    const operators = new Map<string, string>();
    for (const page of pages) {
      for (const row of page.availability) {
        const id = parkingText(row.CarParkID);
        if (id) live.set(id, row);
      }
      for (const row of page.operators) {
        const id = parkingText(row.OperatorID);
        const name = parkingNameOf(row.OperatorName) || parkingText(row.Name);
        if (id && name) operators.set(id, name);
      }
    }
    return pages.flatMap((page) =>
      page.lots
        .map((row) =>
          toLot(
            row,
            live.get(parkingText(row.CarParkID)),
            operators.get(parkingText(row.OperatorID)) ?? "",
            page.city,
          ),
        )
        .filter((item): item is NormalizedParkingLot => Boolean(item)),
    );
  } catch {
    return [];
  }
}

export const tdxParkingProvider: ParkingProvider = {
  source: TDX_PARKING_SOURCE,
  city: "全國",
  async fetchNormalized(query) {
    if (!query?.center) return [];
    return fetchTdxParkingLots(query.center, (query.radiusMeters ?? 3000) / 1000);
  },
};
