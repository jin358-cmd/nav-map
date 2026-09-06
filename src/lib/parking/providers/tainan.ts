import "server-only";

import {
  PARKING_STALE_AFTER_MS,
  PARKING_USER_AGENT,
  TAINAN_PARKING_SOURCE,
  TAINAN_PARKWEB_URL,
} from "@/lib/parking/constants";
import { classifyParkingFee } from "@/lib/parking-meta";
import type {
  NormalizedParkingLot,
  ParkingRateType,
} from "@/lib/parking/schema";
import type { ParkingAvailabilityStatus } from "@/types/domain";
import type { ParkingProvider } from "@/lib/parking/providers/types";

function text(value: unknown) {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return "";
}

function number(value: unknown) {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function spaceCount(value: number | null) {
  if (value == null || value < 0) return null;
  return Math.round(value);
}

function parseLngLatPair(value: unknown) {
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

function parseTimestamp(value: unknown) {
  const raw = text(value);
  if (!raw) return null;
  const hasZone = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(raw);
  const normalized = raw.includes("T") ? raw : raw.replace(" ", "T");
  const date = new Date(hasZone ? normalized : `${normalized}+08:00`);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

function parseHourlyRate(description: string) {
  const half = description.match(/(?:每)?半小時\s*\$?\s*(\d+(?:\.\d+)?)/);
  if (half) return Number(half[1]) * 2;
  const hour = description.match(
    /(?:每小時|1小時|小時|\/H|\/h)\s*[:：]?\s*\$?\s*(\d+(?:\.\d+)?)|\$\s*(\d+(?:\.\d+)?)\s*\/\s*H/i,
  );
  if (hour) return Number(hour[1] ?? hour[2]);
  const yuan = description.match(/(\d+(?:\.\d+)?)\s*元/);
  if (yuan && /時|小時|H/i.test(description)) return Number(yuan[1]);
  return null;
}

function parseDailyMax(description: string) {
  const match = description.match(
    /(?:當日(?:當次)?最高(?:上限)?|每日上限|上限)\s*\$?\s*(\d+(?:\.\d+)?)/,
  );
  return match ? Number(match[1]) : null;
}

function availabilityStatus(
  available: number | null,
  timestamp: string | null,
): ParkingAvailabilityStatus {
  if (available == null) return "unknown";
  if (timestamp) {
    const age = Date.now() - new Date(timestamp).getTime();
    if (!Number.isFinite(age) || age < 0 || age > PARKING_STALE_AFTER_MS) {
      return "stale";
    }
  } else {
    return "unknown";
  }
  if (available <= 0) return "full";
  return "available";
}

function toLot(value: unknown): NormalizedParkingLot | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  const location = parseLngLatPair(row.lnglat);
  if (!location) return null;
  const sourceParkingId = text(row.code) || text(row.id);
  if (!sourceParkingId) return null;
  const typeName = text(row.typeName);
  const name = text(row.name) || "停車場";
  const fee = text(row.chargeFee);
  const feeClass = /免費|無收費/.test(`${typeName}${fee}${name}`)
    ? "free"
    : /收費|元|\$/.test(`${typeName}${fee}`)
      ? "paid"
      : classifyParkingFee(fee);
  const carAvailable = spaceCount(number(row.car));
  const carTotal = spaceCount(number(row.car_total));
  const motorcycleTotal = spaceCount(number(row.moto_total));
  const disabledSpaces = spaceCount(number(row.carDis_total));
  const totalSpaces =
    spaceCount(
      (carTotal ?? 0) + (motorcycleTotal ?? 0) + (disabledSpaces ?? 0),
    ) || carTotal;
  const dataTimestamp = parseTimestamp(row.update_time);
  const rateDescription = fee || typeName;
  const hourlyRate = feeClass === "free" ? 0 : parseHourlyRate(rateDescription);
  const dailyMax = parseDailyMax(rateDescription);
  const rateType: ParkingRateType =
    feeClass === "free" ? "free" : hourlyRate != null ? "hourly" : "unknown";
  const availableSpaces = carAvailable;
  const status = availabilityStatus(availableSpaces, dataTimestamp);
  const occupancyRate =
    availableSpaces != null && carTotal && carTotal > 0
      ? Number(((carTotal - availableSpaces) / carTotal).toFixed(4))
      : null;

  return {
    id: `${TAINAN_PARKING_SOURCE}:${sourceParkingId}`,
    source: TAINAN_PARKING_SOURCE,
    sourceParkingId,
    name,
    address: text(row.address),
    latitude: location.lat,
    longitude: location.lng,
    totalSpaces,
    carSpaces: carTotal,
    motorcycleSpaces: motorcycleTotal,
    disabledSpaces,
    operatingHours: text(row.chargeTime),
    phone: "",
    operator: typeName || "臺南市停車管理",
    city: "臺南市",
    district: text(row.zone),
    isActive: true,
    publicLot: /公有|公營|智慧停車/.test(typeName),
    registered: true,
    feeClass,
    availability: {
      availableSpaces,
      totalSpaces: carTotal,
      occupancyRate,
      dataTimestamp,
      status,
    },
    rate: {
      vehicleType: /機車/.test(name) ? "motorcycle" : "car",
      rateType,
      hourlyRate,
      dailyMax,
      description: rateDescription,
    },
  };
}

export const tainanParkingProvider: ParkingProvider = {
  source: TAINAN_PARKING_SOURCE,
  city: "臺南市",
  async fetchNormalized() {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 12_000);
    try {
      const response = await fetch(TAINAN_PARKWEB_URL, {
        headers: {
          Accept: "application/json",
          "User-Agent": PARKING_USER_AGENT,
        },
        cache: "no-store",
        signal: controller.signal,
      });
      if (!response.ok) return [];
      const payload = (await response.json()) as unknown;
      const rows = Array.isArray(payload)
        ? payload
        : payload &&
            typeof payload === "object" &&
            Array.isArray((payload as { data?: unknown }).data)
          ? ((payload as { data: unknown[] }).data)
          : [];
      return rows
        .map((row) => toLot(row))
        .filter((item): item is NormalizedParkingLot => Boolean(item));
    } catch {
      return [];
    } finally {
      clearTimeout(timer);
    }
  },
};
