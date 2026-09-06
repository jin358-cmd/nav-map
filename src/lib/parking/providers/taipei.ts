import "server-only";

import { inferPublicLot, matchParkingBrand } from "@/lib/parking/brands";
import {
  PARKING_USER_AGENT,
  TAIPEI_PARK_AVAIL_URL,
  TAIPEI_PARK_DESC_URL,
  TAIPEI_PARKING_SOURCE,
} from "@/lib/parking/constants";
import { classifyParkingFee } from "@/lib/parking-meta";
import {
  parkingAvailabilityStatus,
  parkingNumber,
  parkingRateType,
  parkingSpaceCount,
  parkingText,
  parseDailyMax,
  parseHourlyRate,
} from "@/lib/parking/parse";
import type { NormalizedParkingLot } from "@/lib/parking/schema";
import type { ParkingProvider } from "@/lib/parking/providers/types";
import { twd97ToWgs84 } from "@/lib/parking/twd97";
import type { LngLat } from "@/types/domain";

const DESC_CACHE_MS = 15 * 60 * 1000;
const AVAIL_CACHE_MS = 90 * 1000;

type Cached<T> = { value: T; expiresAt: number };

let descCache: Cached<Record<string, unknown>[]> | null = null;
let availCache: Cached<{
  rows: Record<string, unknown>[];
  updatedAt: string | null;
}> | null = null;

function parseTaipeiTime(value: unknown) {
  const raw = parkingText(value);
  if (!raw) return null;
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function entranceWgs84(row: Record<string, unknown>): LngLat | null {
  const coord = row.EntranceCoord;
  const info =
    coord && typeof coord === "object"
      ? (coord as { EntrancecoordInfo?: Array<Record<string, unknown>> })
          .EntrancecoordInfo
      : null;
  const first = Array.isArray(info) ? info[0] : null;
  if (!first) return null;
  const a = parkingNumber(first.Xcod);
  const b = parkingNumber(first.Ycod);
  if (a == null || b == null) return null;
  if (a > 21 && a < 26 && b > 119 && b < 123) return { lat: a, lng: b };
  if (b > 21 && b < 26 && a > 119 && a < 123) return { lat: b, lng: a };
  return null;
}

function locationOf(row: Record<string, unknown>): LngLat | null {
  const entrance = entranceWgs84(row);
  if (entrance) return entrance;
  const x = parkingNumber(row.tw97x);
  const y = parkingNumber(row.tw97y);
  if (x == null || y == null || x <= 0 || y <= 0) return null;
  const converted = twd97ToWgs84(x, y);
  if (
    converted.lat < 24.9 ||
    converted.lat > 25.25 ||
    converted.lng < 121.45 ||
    converted.lng > 121.7
  ) {
    return null;
  }
  return converted;
}

async function fetchJson(url: string) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 14_000);
  try {
    const response = await fetch(url, {
      headers: {
        Accept: "application/json",
        "User-Agent": PARKING_USER_AGENT,
      },
      cache: "no-store",
      signal: controller.signal,
    });
    if (!response.ok) return null;
    return (await response.json()) as unknown;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function loadDescriptions() {
  if (descCache && descCache.expiresAt > Date.now()) return descCache.value;
  const payload = await fetchJson(TAIPEI_PARK_DESC_URL);
  const park =
    payload &&
    typeof payload === "object" &&
    (payload as { data?: { park?: unknown } }).data?.park;
  const rows = Array.isArray(park) ? (park as Record<string, unknown>[]) : [];
  descCache = { value: rows, expiresAt: Date.now() + DESC_CACHE_MS };
  return rows;
}

async function loadAvailability() {
  if (availCache && availCache.expiresAt > Date.now()) return availCache.value;
  const payload = await fetchJson(TAIPEI_PARK_AVAIL_URL);
  const data =
    payload && typeof payload === "object"
      ? (payload as { data?: { park?: unknown; UPDATETIME?: unknown } }).data
      : null;
  const rows = Array.isArray(data?.park)
    ? (data.park as Record<string, unknown>[])
    : [];
  availCache = {
    value: { rows, updatedAt: parseTaipeiTime(data?.UPDATETIME) },
    expiresAt: Date.now() + AVAIL_CACHE_MS,
  };
  return availCache.value;
}

function toLot(
  row: Record<string, unknown>,
  live: Record<string, unknown> | undefined,
  updatedAt: string | null,
): NormalizedParkingLot | null {
  const location = locationOf(row);
  if (!location) return null;
  const sourceParkingId = parkingText(row.id);
  if (!sourceParkingId) return null;
  const name = parkingText(row.name) || "停車場";
  const typeName = parkingText(row.type2);
  const fee = parkingText(row.payex);
  const brand = matchParkingBrand(name, typeName);
  const feeClass = /免費|無收費/.test(`${typeName}${fee}${name}`)
    ? "free"
    : classifyParkingFee(fee);
  const carAvailable = parkingSpaceCount(parkingNumber(live?.availablecar));
  const carTotal = parkingSpaceCount(parkingNumber(row.totalcar));
  const motorcycleTotal = parkingSpaceCount(parkingNumber(row.totalmotor));
  const hourlyRate = feeClass === "free" ? 0 : parseHourlyRate(fee);
  const occupancyRate =
    carAvailable != null && carTotal && carTotal > 0
      ? Number(((carTotal - carAvailable) / carTotal).toFixed(4))
      : null;

  return {
    id: `${TAIPEI_PARKING_SOURCE}:${sourceParkingId}`,
    source: TAIPEI_PARKING_SOURCE,
    sourceParkingId,
    name,
    address: parkingText(row.address),
    latitude: location.lat,
    longitude: location.lng,
    totalSpaces: carTotal,
    carSpaces: carTotal,
    motorcycleSpaces: motorcycleTotal,
    disabledSpaces: parkingSpaceCount(parkingNumber(row.Handicap_First)),
    operatingHours: parkingText(row.serviceTime),
    phone: parkingText(row.tel),
    operator: typeName || "臺北市停管處",
    brand,
    city: "臺北市",
    district: parkingText(row.area),
    isActive: true,
    publicLot: inferPublicLot({
      typeName,
      name,
      operator: typeName,
      brand,
    }),
    registered: true,
    feeClass,
    availability: {
      availableSpaces: carAvailable,
      totalSpaces: carTotal,
      occupancyRate,
      dataTimestamp: updatedAt,
      status: parkingAvailabilityStatus(carAvailable, updatedAt),
    },
    rate: {
      vehicleType: /機車/.test(name) ? "motorcycle" : "car",
      rateType: parkingRateType(feeClass, hourlyRate),
      hourlyRate,
      dailyMax: parseDailyMax(fee),
      description: fee || typeName,
    },
  };
}

export async function fetchTaipeiParkingLots(): Promise<NormalizedParkingLot[]> {
  const [rows, live] = await Promise.all([loadDescriptions(), loadAvailability()]);
  if (!rows.length) return [];
  const byId = new Map(
    live.rows.map((row) => [parkingText(row.id), row] as const),
  );
  return rows
    .map((row) => toLot(row, byId.get(parkingText(row.id)), live.updatedAt))
    .filter((item): item is NormalizedParkingLot => Boolean(item));
}

export const taipeiParkingProvider: ParkingProvider = {
  source: TAIPEI_PARKING_SOURCE,
  city: "臺北市",
  async fetchNormalized() {
    return fetchTaipeiParkingLots();
  },
};
