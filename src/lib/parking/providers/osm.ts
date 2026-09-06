import "server-only";

import { inferPublicLot, matchParkingBrand } from "@/lib/parking/brands";
import {
  OSM_OVERPASS_URL,
  OSM_PARKING_SOURCE,
  PARKING_USER_AGENT,
} from "@/lib/parking/constants";
import { classifyParkingFee } from "@/lib/parking-meta";
import {
  parkingNumber,
  parkingRateType,
  parkingSpaceCount,
  parkingText,
  parseHourlyRate,
} from "@/lib/parking/parse";
import type { NormalizedParkingLot } from "@/lib/parking/schema";
import type { ParkingProvider } from "@/lib/parking/providers/types";
import type { LngLat } from "@/types/domain";

type OverpassElement = {
  id?: number;
  lat?: number;
  lon?: number;
  center?: { lat?: number; lon?: number };
  tags?: Record<string, string | undefined>;
};

const cache = new Map<
  string,
  { lots: NormalizedParkingLot[]; expiresAt: number }
>();

function osmFeeClass(tags: Record<string, string | undefined> | undefined) {
  const fee = parkingText(tags?.fee);
  if (/^no|free$/i.test(fee)) return classifyParkingFee("免費");
  if (/^yes|ticket|interval$/i.test(fee)) return classifyParkingFee("收費");
  return classifyParkingFee(
    fee || parkingText(tags?.charge) || parkingText(tags?.["fee:amount"]),
  );
}

function toLot(
  element: OverpassElement,
  index: number,
): NormalizedParkingLot | null {
  const lng = parkingNumber(element.lon ?? element.center?.lon);
  const lat = parkingNumber(element.lat ?? element.center?.lat);
  if (lng == null || lat == null) return null;
  const tags = element.tags ?? {};
  const access = parkingText(tags.access).toLowerCase();
  if (["private", "no", "residents", "employees"].includes(access)) return null;
  const name =
    parkingText(tags.name) ||
    parkingText(tags["name:zh"]) ||
    parkingText(tags.brand) ||
    parkingText(tags.operator) ||
    "停車場";
  const operator = parkingText(tags.operator) || parkingText(tags.brand);
  const brand = matchParkingBrand(
    name,
    operator,
    parkingText(tags.brand),
    parkingText(tags["brand:zh"]),
  );
  const feeText =
    parkingText(tags.charge) ||
    parkingText(tags["fee:amount"]) ||
    (parkingText(tags.fee) === "no"
      ? "免費"
      : parkingText(tags.fee) === "yes"
        ? "收費"
        : parkingText(tags.fee));
  const feeClass = osmFeeClass(tags);
  const carTotal = parkingSpaceCount(
    parkingNumber(tags.capacity ?? tags["capacity:cars"]),
  );
  const motorcycleTotal = parkingSpaceCount(
    parkingNumber(tags["capacity:motorcycles"]),
  );
  const sourceParkingId = String(element.id ?? index);

  return {
    id: `${OSM_PARKING_SOURCE}:${sourceParkingId}`,
    source: OSM_PARKING_SOURCE,
    sourceParkingId,
    name,
    address:
      parkingText(tags["addr:full"]) ||
      parkingText(tags["addr:street"]) ||
      [parkingText(tags["addr:city"]), parkingText(tags["addr:district"])]
        .filter(Boolean)
        .join(""),
    latitude: lat,
    longitude: lng,
    totalSpaces: carTotal,
    carSpaces: carTotal,
    motorcycleSpaces: motorcycleTotal,
    disabledSpaces: parkingSpaceCount(
      parkingNumber(tags["capacity:disabled"]),
    ),
    operatingHours: parkingText(tags.opening_hours),
    phone: parkingText(tags.phone),
    operator,
    brand,
    city: parkingText(tags["addr:city"]),
    district: parkingText(tags["addr:district"]),
    isActive: true,
    publicLot: inferPublicLot({
      name,
      operator,
      brand,
      typeName: parkingText(tags.ownership),
    }),
    registered: Boolean(
      parkingText(tags.ref) || parkingText(tags["ref:tdx"]),
    ),
    feeClass,
    availability: {
      availableSpaces: null,
      totalSpaces: carTotal,
      occupancyRate: null,
      dataTimestamp: null,
      status: "unknown",
    },
    rate: {
      vehicleType: /機車/.test(name) ? "motorcycle" : "car",
      rateType: parkingRateType(feeClass, parseHourlyRate(feeText)),
      hourlyRate: feeClass === "free" ? 0 : parseHourlyRate(feeText),
      dailyMax: null,
      description: feeText,
    },
  };
}

export async function fetchOsmParkingLots(
  center: LngLat,
  radiusMeters: number,
): Promise<NormalizedParkingLot[]> {
  const radius = Math.round(Math.min(Math.max(radiusMeters, 400), 5000));
  const key = `${center.lat.toFixed(3)}:${center.lng.toFixed(3)}:${radius}`;
  const hit = cache.get(key);
  if (hit && hit.expiresAt > Date.now()) return hit.lots;

  const body = `[out:json][timeout:12];
(
  nwr["amenity"="parking"]["access"!="private"]["access"!="no"]["access"!="residents"]["access"!="employees"](around:${radius},${center.lat},${center.lng});
  nwr["amenity"="parking"]["brand"~"嘟嘟房|Times|台灣聯通|格上|城市車旅|竑穗|停簡單|俥酷",i](around:${radius},${center.lat},${center.lng});
  nwr["amenity"="parking"]["operator"~"嘟嘟房|台灣聯通|格上停車|城市車旅|竑穗",i](around:${radius},${center.lat},${center.lng});
  nwr["amenity"="parking"]["name"~"嘟嘟房|台灣聯通|格上停車|城市車旅|竑穗|停簡單",i](around:${radius},${center.lat},${center.lng});
);
out center tags;`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 13_000);
  try {
    const response = await fetch(OSM_OVERPASS_URL, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
        "User-Agent": PARKING_USER_AGENT,
      },
      body: new URLSearchParams({ data: body }),
      cache: "no-store",
      signal: controller.signal,
    });
    if (!response.ok) return [];
    const payload = (await response.json()) as { elements?: OverpassElement[] };
    const lots = (payload.elements ?? [])
      .map((element, index) => toLot(element, index))
      .filter((item): item is NormalizedParkingLot => Boolean(item));
    cache.set(key, { lots, expiresAt: Date.now() + 5 * 60 * 1000 });
    return lots;
  } catch {
    return [];
  } finally {
    clearTimeout(timer);
  }
}

export const osmParkingProvider: ParkingProvider = {
  source: OSM_PARKING_SOURCE,
  city: "OpenStreetMap",
  async fetchNormalized(query) {
    if (!query?.center) return [];
    return fetchOsmParkingLots(query.center, query.radiusMeters ?? 1000);
  },
};
