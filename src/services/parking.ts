import "server-only";
import { resolveFreshness } from "@/lib/event-freshness";
import { distanceKm } from "@/lib/geo";
import { isInTainan, parkingCitiesNear } from "@/lib/parking-cities";
import {
  chargeTypesOf,
  classifyParkingFee,
  flagOf,
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
  ParkingDataOrigin,
  ParkingFill,
  ParkingLot,
} from "@/types/domain";

const TAINAN_PARKWEB_URL = "https://parkweb.tainan.gov.tw/api/parking.php?mode=0";
const OVERPASS = "https://overpass-api.de/api/interpreter";
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
  const catalogs: ParkingCatalog[] = [];
  if (isTdxConfigured()) {
    const tdx = await fromTdx(center);
    if (tdx.lots.length) catalogs.push(tdx);
  }
  if (!catalogs.length && isInTainan(center)) {
    const tainan = await fromTainanOpen();
    if (tainan.lots.length) catalogs.push(tainan);
  }
  if (!catalogs.length) {
    const osm = await fromOsmPublic(center, radiusKm);
    if (osm.lots.length) catalogs.push(osm);
  } else if (catalogs[0].origin !== "tdx-live") {
    const osm = await fromOsmPublic(center, radiusKm);
    if (osm.lots.length) {
      catalogs[0] = {
        ...catalogs[0],
        lots: mergeLots(catalogs[0].lots, osm.lots),
      };
    }
  }

  if (!catalogs.length) return emptyCatalog();
  const origin = catalogs[0].origin;
  const lots = withDistance(
    catalogs.flatMap((catalog) => catalog.lots),
    center,
    radiusKm,
  );
  return {
    origin,
    lots,
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
  const carAvailable = spaceCount(number(row.car));
  const carTotal = spaceCount(number(row.car_total));
  const fee = text(row.chargeFee);
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
    feeClass: classifyParkingFee(fee),
    publicLot: true,
    registered: true,
    hours: text(row.chargeTime),
    updatedAt,
    source: "臺南市停車動態資訊",
    origin: "tainan-open",
    freshness,
    fill: parkingFill(carAvailable, carTotal, freshness),
  };
}

type OverpassElement = {
  id?: number;
  lat?: number;
  lon?: number;
  center?: { lat?: number; lon?: number };
  tags?: Record<string, string | undefined>;
};

async function fromOsmPublic(center: LngLat, radiusKm: number): Promise<ParkingCatalog> {
  const radius = Math.round(Math.min(Math.max(radiusKm, 3), 8) * 1000);
  const body = `[out:json][timeout:12];
(
  nwr["amenity"="parking"]["ownership"="public"](around:${radius},${center.lat},${center.lng});
  nwr["amenity"="parking"]["operator:type"="government"](around:${radius},${center.lat},${center.lng});
  nwr["amenity"="parking"]["name"~"公有|公營|市立|縣立|鄉立|鎮立",i](around:${radius},${center.lat},${center.lng});
  nwr["amenity"="parking"]["operator"~"市府|縣府|公所|停管處|交通局|公路局|停車場管理",i](around:${radius},${center.lat},${center.lng});
);
out center tags;`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 13_000);
  try {
    const response = await fetch(OVERPASS, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
        "User-Agent": USER_AGENT,
      },
      body: new URLSearchParams({ data: body }),
      cache: "no-store",
      signal: controller.signal,
    });
    if (!response.ok) return emptyCatalog();
    const payload = (await response.json()) as { elements?: OverpassElement[] };
    const lots = (payload.elements ?? [])
      .map((element, index) => toOsmLot(element, index))
      .filter((item): item is ParkingLot => Boolean(item));
    if (!lots.length) return emptyCatalog();
    return {
      origin: "osm-open",
      lots,
      fetchedAt: new Date().toISOString(),
    };
  } catch {
    return emptyCatalog();
  } finally {
    clearTimeout(timer);
  }
}

function osmFeeClass(tags: Record<string, string | undefined> | undefined) {
  const fee = text(tags?.fee);
  if (/^no|free$/i.test(fee)) return classifyParkingFee("免費");
  if (/^yes|ticket|interval$/i.test(fee)) return classifyParkingFee("收費");
  return classifyParkingFee(fee || text(tags?.charge) || text(tags?.["fee:amount"]));
}

function toOsmLot(element: OverpassElement, index: number): ParkingLot | null {
  const lng = number(element.lon ?? element.center?.lon);
  const lat = number(element.lat ?? element.center?.lat);
  if (lng == null || lat == null) return null;
  const tags = element.tags ?? {};
  const name = text(tags.name) || text(tags["name:zh"]) || "公有停車場";
  const ref = text(tags.ref) || text(tags["ref:tdx"]) || text(tags["parking:ref"]);
  const capacity = spaceCount(number(tags.capacity ?? tags["capacity:cars"]));
  const fee = text(tags.charge) || text(tags["fee:amount"]) || text(tags.fee);
  const origin: ParkingDataOrigin = "osm-open";
  return {
    id: `osm-${element.id ?? index}`,
    name,
    address:
      text(tags["addr:full"]) ||
      text(tags["addr:street"]) ||
      [text(tags["addr:city"]), text(tags["addr:district"])].filter(Boolean).join(""),
    location: { lat, lng },
    carAvailable: null,
    carTotal: capacity,
    motorcycleAvailable: spaceCount(number(tags["capacity:motorcycles"])),
    motorcycleTotal: spaceCount(number(tags["capacity:motorcycles"])),
    fee: fee && !/^yes|no$/i.test(fee) ? fee : fee === "no" ? "免費" : fee === "yes" ? "收費" : "",
    feeClass: osmFeeClass(tags),
    publicLot: true,
    registered: Boolean(ref) || flagOf(tags.official) === 1,
    hours: text(tags.opening_hours),
    source: "OpenStreetMap 公有停車場",
    origin,
    freshness: "stale",
    fill: "unknown",
  };
}
