import "server-only";
import { resolveFreshness } from "@/lib/event-freshness";
import { distanceKm } from "@/lib/geo";
import {
  isInTainan,
  parkingCitiesNear,
  parkingCityLabelNear,
} from "@/lib/parking-cities";
import {
  chargeTypesOf,
  classifyParkingFee,
  isPublicParkingLot,
} from "@/lib/parking-meta";
import {
  fetchCityParkingAvailability,
  fetchCityParkingLots,
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
const USER_AGENT = "NavPilot/0.1 (https://github.com/jin358-cmd/nav-map)";
const LOTS_CACHE_MS = 15 * 60 * 1000;
const AVAIL_CACHE_MS = 90 * 1000;

type CachedRows = {
  rows: Record<string, unknown>[];
  expiresAt: number;
};

const lotsCache = new Map<string, CachedRows>();
const availCache = new Map<string, CachedRows>();

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
  if (Math.abs(a) > 90 && Math.abs(b) <= 90 && Math.abs(a) <= 180) {
    return { lng: a, lat: b };
  }
  if (Math.abs(a) <= 90 && Math.abs(b) <= 180) {
    return { lat: a, lng: b };
  }
  return null;
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

function withDistance(lots: ParkingLot[], center: LngLat, radiusKm: number) {
  return lots
    .map((lot) => ({
      ...lot,
      distanceMeters: Math.round(distanceKm(center, lot.location) * 1000),
    }))
    .filter((lot) => (lot.distanceMeters ?? Infinity) <= radiusKm * 1000)
    .sort((a, b) => (a.distanceMeters ?? 0) - (b.distanceMeters ?? 0));
}

function mergeLots(primary: ParkingLot[], extra: ParkingLot[]) {
  const merged = [...primary];
  for (const lot of extra) {
    const duplicate = merged.some(
      (item) =>
        item.id === lot.id ||
        distanceKm(item.location, lot.location) < 0.08,
    );
    if (!duplicate) merged.push(lot);
  }
  return merged;
}

export async function loadNearbyParking(center: LngLat, radiusKm = 4): Promise<ParkingCatalog> {
  if (isTdxConfigured()) {
    const tdx = await fromTdx(center);
    if (tdx.lots.length) {
      return { ...tdx, lots: withDistance(tdx.lots, center, radiusKm) };
    }
  }

  const catalogs: ParkingCatalog[] = [];
  if (isInTainan(center)) {
    const tainan = await fromTainanOpen();
    if (tainan.lots.length) catalogs.push(tainan);
  }
  const osm = await fromNominatimPublic(center, radiusKm);
  if (osm.lots.length) catalogs.push(osm);

  if (!catalogs.length) return emptyCatalog();
  return {
    origin: catalogs[0].origin,
    lots: withDistance(
      catalogs.slice(1).reduce((lots, catalog) => mergeLots(lots, catalog.lots), catalogs[0].lots),
      center,
      radiusKm,
    ),
    fetchedAt: catalogs[0].fetchedAt,
  };
}

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

async function fromTdx(center: LngLat): Promise<ParkingCatalog> {
  const cities = parkingCitiesNear(center, 12);
  try {
    const pages = await Promise.all(
      cities.map(async (city) => {
        const [lots, availability] = await Promise.all([
          cachedCityRows(lotsCache, city, LOTS_CACHE_MS, () =>
            fetchCityParkingLots(city),
          ),
          cachedCityRows(availCache, `avail-${city}`, AVAIL_CACHE_MS, () =>
            fetchCityParkingAvailability(city),
          ).catch(() => [] as Record<string, unknown>[]),
        ]);
        return { lots, availability };
      }),
    );
    const live = new Map<string, Record<string, unknown>>();
    for (const page of pages) {
      for (const row of page.availability) {
        const id = text(row.CarParkID);
        if (id) live.set(id, row);
      }
    }
    const items = pages
      .flatMap((page) => page.lots)
      .map((row) => toTdxLot(row, live.get(text(row.CarParkID))))
      .filter((item): item is ParkingLot => Boolean(item));
    if (!items.length) return emptyCatalog();
    return {
      origin: "tdx-live",
      lots: items,
      fetchedAt: new Date().toISOString(),
    };
  } catch {
    return emptyCatalog();
  }
}

function toTdxLot(
  row: Record<string, unknown>,
  live?: Record<string, unknown>,
): ParkingLot | null {
  const location = pointOf(row);
  if (!location) return null;
  const name = nameOf(row.CarParkName) || nameOf(live?.CarParkName) || "停車場";
  if (
    !isPublicParkingLot({
      isPublic: row.IsPublic,
      operationType: row.OperationType,
      name,
    })
  ) {
    return null;
  }
  const id = text(row.CarParkID) || `tdx-${location.lat}-${location.lng}`;
  const updatedAt = text(live?.DataCollectTime) || text(row.UpdateTime);
  const freshness = resolveFreshness("tdx-live", updatedAt);
  const typed = spacesFromAvailabilities(live?.Availabilities);
  const total = spaceCount(number(live?.TotalSpaces) ?? number(row.TotalSpaces));
  const available = spaceCount(number(live?.AvailableSpaces));
  const carAvailable = typed.carAvailable ?? available;
  const carTotal = typed.carTotal ?? total;
  const fee = text(row.FareDescription) || text(row.Description);
  const feeClass = classifyParkingFee(fee, chargeTypesOf(row.ChargeTypes));
  return {
    id,
    name,
    address: text(row.Address) || text(row.Description),
    location,
    carAvailable,
    carTotal,
    motorcycleAvailable: typed.motorcycleAvailable,
    motorcycleTotal: typed.motorcycleTotal,
    fee,
    feeClass,
    publicLot: true,
    registered: Boolean(text(row.CarParkID)),
    hours: text(row.ServiceTime) || text(row.BusinessHours),
    updatedAt,
    source: "TDX 全國公有停車場",
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
  const typeName = text(row.typeName);
  if (/民營/.test(typeName)) return null;
  if (typeName && !/公有|公營/.test(typeName)) return null;
  const carAvailable = spaceCount(number(row.car));
  const carTotal = spaceCount(number(row.car_total));
  const fee = text(row.chargeFee) || typeName;
  const feeClass = /免費|無收費/.test(typeName)
    ? "free"
    : /收費/.test(typeName)
      ? "paid"
      : classifyParkingFee(fee);
  return {
    id: text(row.id) || text(row.code) || `tainan-${location.lat}-${location.lng}`,
    name: text(row.name) || "停車場",
    address: text(row.address),
    location,
    carAvailable,
    carTotal,
    motorcycleAvailable: spaceCount(number(row.moto)),
    motorcycleTotal: spaceCount(number(row.moto_total)),
    fee,
    feeClass,
    publicLot: true,
    registered: true,
    hours: text(row.chargeTime),
    updatedAt,
    source: "臺南市公有停車場",
    origin: "tainan-open",
    freshness,
    fill: parkingFill(carAvailable, carTotal, freshness),
  };
}

type NominatimParkingRow = {
  place_id?: number;
  osm_id?: number;
  name?: string;
  display_name?: string;
  lat?: string;
  lon?: string;
  type?: string;
  class?: string;
};

async function fromNominatimPublic(
  center: LngLat,
  radiusKm: number,
): Promise<ParkingCatalog> {
  const city = parkingCityLabelNear(center);
  const queries = [
    "公有停車場",
    "免費停車場",
    city ? `${city}公有停車場` : "",
    city ? `${city}免費停車場` : "",
  ].filter(Boolean);
  const lots: ParkingLot[] = [];
  for (const query of queries) {
    const page = await nominatimParking(query, center, radiusKm);
    for (const lot of page) {
      if (!lots.some((item) => item.id === lot.id || distanceKm(item.location, lot.location) < 0.08)) {
        lots.push(lot);
      }
    }
  }
  if (!lots.length) return emptyCatalog();
  return {
    origin: "osm-open",
    lots,
    fetchedAt: new Date().toISOString(),
  };
}

async function nominatimParking(
  query: string,
  center: LngLat,
  radiusKm: number,
): Promise<ParkingLot[]> {
  const padLat = Math.max(radiusKm, 4) / 111;
  const padLng =
    Math.max(radiusKm, 4) / (111 * Math.max(Math.cos((center.lat * Math.PI) / 180), 0.2));
  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("q", query);
  url.searchParams.set("countrycodes", "tw");
  url.searchParams.set("limit", "20");
  url.searchParams.set("accept-language", "zh-TW");
  url.searchParams.set("bounded", "1");
  url.searchParams.set(
    "viewbox",
    `${center.lng - padLng},${center.lat + padLat},${center.lng + padLng},${center.lat - padLat}`,
  );
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8_000);
  try {
    const response = await fetch(url, {
      headers: {
        Accept: "application/json",
        "Accept-Language": "zh-TW",
        "User-Agent": USER_AGENT,
      },
      cache: "no-store",
      signal: controller.signal,
    });
    if (!response.ok) return [];
    const rows = (await response.json()) as NominatimParkingRow[];
    return rows
      .map((row) => toNominatimLot(row, query))
      .filter((item): item is ParkingLot => Boolean(item));
  } catch {
    return [];
  } finally {
    clearTimeout(timer);
  }
}

function toNominatimLot(
  row: NominatimParkingRow,
  query: string,
): ParkingLot | null {
  const lat = number(row.lat);
  const lng = number(row.lon);
  if (lat == null || lng == null) return null;
  const name = text(row.name) || text(row.display_name).split(",")[0] || "公有停車場";
  const address = text(row.display_name);
  const blob = `${name} ${address}`;
  if (!/停車/.test(blob)) return null;
  if (!/公有|公營|市立|縣立|鄉立|鎮立|免費停車/.test(blob)) return null;
  if (/民營|私人|工作停車場|private/i.test(blob) && !/公有|公營|市立|縣立/.test(blob)) {
    return null;
  }
  const feeHint = /免費/.test(query) ? "免費" : query;
  const feeClass = /免費|無收費/.test(blob)
    ? "free"
    : /收費/.test(blob)
      ? "paid"
      : classifyParkingFee(feeHint);
  return {
    id: `osm-${row.osm_id ?? row.place_id ?? `${lat}-${lng}`}`,
    name,
    address,
    location: { lat, lng },
    carAvailable: null,
    carTotal: null,
    fee: /免費|無收費/.test(blob) ? "免費" : /收費/.test(blob) ? "收費" : "",
    feeClass,
    publicLot: true,
    registered: /公有|市立|縣立|鄉立|鎮立/.test(blob),
    source: "OpenStreetMap 公有停車場",
    origin: "osm-open",
    freshness: "stale",
    fill: "unknown",
  };
}
