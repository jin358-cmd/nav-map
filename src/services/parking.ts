import "server-only";
import { resolveFreshness } from "@/lib/event-freshness";
import { distanceKm } from "@/lib/geo";
import {
  fetchTainanParkingAvailability,
  fetchTainanParkingLots,
  isTdxConfigured,
} from "@/services/tdx-client";
import type {
  DataFreshness,
  LngLat,
  ParkingCatalog,
  ParkingFill,
  ParkingLot,
} from "@/types/domain";

const TAINAN_PARKWEB_URL = "https://parkweb.tainan.gov.tw/api/parking.php?mode=0";

function text(value: unknown) {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return "";
}

function number(value: unknown) {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function nameOf(value: unknown) {
  if (typeof value === "string") return value.trim();
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return text(record.Zh_tw) || text(record.zh_tw) || text(record.En);
  }
  return "";
}

function pointOf(row: Record<string, unknown>): LngLat | null {
  const position =
    row.CarParkPosition && typeof row.CarParkPosition === "object"
      ? (row.CarParkPosition as Record<string, unknown>)
      : row;
  const lat = number(position.PositionLat ?? position.lat ?? row.Latitude);
  const lng = number(position.PositionLon ?? position.lng ?? row.Longitude);
  if (lat == null || lng == null) return null;
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  return { lat, lng };
}

function parseLngLatPair(value: unknown): LngLat | null {
  const raw = text(value);
  const parts = raw.split(/[, ]+/).map(Number).filter(Number.isFinite);
  if (parts.length < 2) return null;
  const [a, b] = parts;
  if (Math.abs(a) <= 90 && Math.abs(b) <= 180) {
    return a > 90 || b > 90 ? { lng: a, lat: b } : { lat: a, lng: b };
  }
  return { lng: a, lat: b };
}

function spaceCount(value: number | null) {
  if (value == null || value < 0) return null;
  return value;
}

function parkingFill(
  available: number | null,
  total: number | null,
  freshness: DataFreshness,
): ParkingFill {
  if (freshness === "unavailable" || available == null) return "unknown";
  if (available <= 0) return "full";
  if (total && total > 0 && available / total <= 0.15) return "limited";
  if (available <= 8) return "limited";
  return "plenty";
}

const CAR_SPACE = new Set([0, 1, 7, 8, 9, 11, 15, 17, 19, 21, 23]);
const MOTO_SPACE = new Set([2, 3, 10, 12, 14, 16, 18, 20, 22]);

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
    const type = number(row.SpaceType);
    const available = spaceCount(number(row.AvailableSpaces));
    const total = spaceCount(number(row.NumberOfSpaces));
    if (type != null && CAR_SPACE.has(type)) {
      carAvailable = (carAvailable ?? 0) + (available ?? 0);
      carTotal = (carTotal ?? 0) + (total ?? 0);
      if (available == null && carAvailable === 0) carAvailable = null;
      if (total == null && carTotal === 0) carTotal = null;
    }
    if (type != null && MOTO_SPACE.has(type)) {
      motorcycleAvailable = (motorcycleAvailable ?? 0) + (available ?? 0);
      motorcycleTotal = (motorcycleTotal ?? 0) + (total ?? 0);
      if (available == null && motorcycleAvailable === 0) motorcycleAvailable = null;
      if (total == null && motorcycleTotal === 0) motorcycleTotal = null;
    }
  }
  return { carAvailable, carTotal, motorcycleAvailable, motorcycleTotal };
}

function emptyCatalog(): ParkingCatalog {
  return {
    origin: "unavailable",
    lots: [],
    fetchedAt: new Date().toISOString(),
  };
}

export async function loadNearbyParking(center: LngLat, radiusKm = 4): Promise<ParkingCatalog> {
  const catalog = isTdxConfigured()
    ? await fromTdx()
    : await fromTainanOpen();
  const lots = catalog.lots
    .map((lot) => ({
      ...lot,
      distanceMeters: Math.round(distanceKm(center, lot.location) * 1000),
    }))
    .filter((lot) => (lot.distanceMeters ?? Infinity) <= radiusKm * 1000)
    .sort((a, b) => (a.distanceMeters ?? 0) - (b.distanceMeters ?? 0));
  return { ...catalog, lots };
}

async function fromTdx(): Promise<ParkingCatalog> {
  try {
    const [lots, availability] = await Promise.all([
      fetchTainanParkingLots(),
      fetchTainanParkingAvailability(),
    ]);
    const live = new Map<string, Record<string, unknown>>();
    for (const row of availability) {
      const id = text(row.CarParkID);
      if (id) live.set(id, row);
    }
    const items = lots
      .map((row) => toTdxLot(row, live.get(text(row.CarParkID))))
      .filter((item): item is ParkingLot => Boolean(item));
    if (!items.length) return emptyCatalog();
    return {
      origin: "tdx-live",
      lots: items,
      fetchedAt: new Date().toISOString(),
    };
  } catch {
    return fromTainanOpen();
  }
}

function toTdxLot(
  row: Record<string, unknown>,
  live?: Record<string, unknown>,
): ParkingLot | null {
  const location = pointOf(row);
  if (!location) return null;
  const id = text(row.CarParkID) || `tdx-${location.lat}-${location.lng}`;
  const updatedAt = text(live?.DataCollectTime) || text(row.UpdateTime);
  const freshness = resolveFreshness("tdx-live", updatedAt);
  const typed = spacesFromAvailabilities(live?.Availabilities);
  const total = spaceCount(number(live?.TotalSpaces) ?? number(row.TotalSpaces));
  const available = spaceCount(number(live?.AvailableSpaces));
  const carAvailable = typed.carAvailable ?? available;
  const carTotal = typed.carTotal ?? total;
  return {
    id,
    name: nameOf(row.CarParkName) || nameOf(live?.CarParkName) || "停車場",
    address: text(row.Address) || text(row.Description),
    location,
    carAvailable,
    carTotal,
    motorcycleAvailable: typed.motorcycleAvailable,
    motorcycleTotal: typed.motorcycleTotal,
    fee: text(row.FareDescription) || text(row.Description),
    hours: text(row.ServiceTime) || text(row.BusinessHours),
    updatedAt,
    source: "TDX 路外停車場",
    origin: "tdx-live",
    freshness,
    fill: parkingFill(carAvailable, carTotal, freshness),
  };
}

async function fromTainanOpen(): Promise<ParkingCatalog> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12_000);
  try {
    const response = await fetch(TAINAN_PARKWEB_URL, {
      headers: { Accept: "application/json" },
      cache: "no-store",
      signal: controller.signal,
    });
    if (!response.ok) return emptyCatalog();
    const payload = (await response.json()) as unknown;
    const rows = Array.isArray(payload)
      ? payload
      : payload && typeof payload === "object" && Array.isArray((payload as { data?: unknown }).data)
        ? ((payload as { data: unknown[] }).data)
        : [];
    const lots = rows
      .map((row) => toParkwebLot(row))
      .filter((item): item is ParkingLot => Boolean(item));
    if (!lots.length) return emptyCatalog();
    return {
      origin: "tainan-open",
      lots,
      fetchedAt: new Date().toISOString(),
    };
  } catch {
    return emptyCatalog();
  } finally {
    clearTimeout(timer);
  }
}

function toParkwebLot(value: unknown): ParkingLot | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  const location = parseLngLatPair(row.lnglat) ?? pointOf(row);
  if (!location) return null;
  const updatedAt = text(row.update_time);
  const freshness = resolveFreshness("tdx-live", updatedAt);
  const carAvailable = spaceCount(number(row.car));
  const carTotal = spaceCount(number(row.car_total));
  return {
    id: text(row.id) || text(row.code) || `tainan-${location.lat}-${location.lng}`,
    name: text(row.name) || "停車場",
    address: text(row.address),
    location,
    carAvailable,
    carTotal,
    motorcycleAvailable: spaceCount(number(row.moto)),
    motorcycleTotal: spaceCount(number(row.moto_total)),
    fee: text(row.chargeFee),
    hours: text(row.chargeTime),
    updatedAt,
    source: "臺南市停車動態資訊",
    origin: "tainan-open",
    freshness,
    fill: parkingFill(carAvailable, carTotal, freshness),
  };
}
