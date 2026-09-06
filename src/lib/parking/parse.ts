import { PARKING_STALE_AFTER_MS } from "@/lib/parking/constants";
import type { ParkingRateType } from "@/lib/parking/schema";
import type { LngLat, ParkingAvailabilityStatus } from "@/types/domain";

export function parkingText(value: unknown) {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return "";
}

export function parkingNumber(value: unknown) {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function parkingSpaceCount(value: number | null) {
  if (value == null || value < 0) return null;
  return Math.round(value);
}

export function parkingNameOf(value: unknown) {
  if (typeof value === "string") return value.trim();
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return (
      parkingText(record.Zh_tw) ||
      parkingText(record.zh_tw) ||
      parkingText(record.En)
    );
  }
  return "";
}

export function parkingPointOf(row: Record<string, unknown>): LngLat | null {
  const position =
    row.CarParkPosition && typeof row.CarParkPosition === "object"
      ? (row.CarParkPosition as Record<string, unknown>)
      : row;
  const lat = parkingNumber(position.PositionLat ?? position.lat ?? row.Latitude);
  const lng = parkingNumber(position.PositionLon ?? position.lng ?? row.Longitude);
  if (lat == null || lng == null) return null;
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  return { lat, lng };
}

export function parseLngLatPair(value: unknown): LngLat | null {
  const raw = parkingText(value);
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

export function parseHourlyRate(description: string) {
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

export function parseDailyMax(description: string) {
  const match = description.match(
    /(?:當日(?:當次)?最高(?:上限)?|每日上限|上限)\s*\$?\s*(\d+(?:\.\d+)?)/,
  );
  return match ? Number(match[1]) : null;
}

export function parkingAvailabilityStatus(
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

export function parkingRateType(
  feeClass: "paid" | "free" | "unknown",
  hourlyRate: number | null,
): ParkingRateType {
  if (feeClass === "free") return "free";
  if (hourlyRate != null) return "hourly";
  return "unknown";
}
