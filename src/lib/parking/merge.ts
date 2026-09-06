import { distanceKm } from "@/lib/geo";
import {
  OSM_PARKING_SOURCE,
  TAIPEI_PARKING_SOURCE,
  TAINAN_PARKING_SOURCE,
  TDX_PARKING_SOURCE,
} from "@/lib/parking/constants";
import type { NormalizedParkingLot } from "@/lib/parking/schema";

function sourceScore(source: string) {
  if (source === TAINAN_PARKING_SOURCE) return 40;
  if (source === TAIPEI_PARKING_SOURCE) return 35;
  if (source === TDX_PARKING_SOURCE) return 30;
  if (source === OSM_PARKING_SOURCE) return 10;
  return 0;
}

function lotScore(lot: NormalizedParkingLot) {
  let score = sourceScore(lot.source);
  if (
    lot.availability.availableSpaces != null &&
    lot.availability.status !== "unknown"
  ) {
    score += 20;
  }
  if (lot.brand) score += 8;
  if (lot.address) score += 2;
  return score;
}

function normalizeName(name: string) {
  return name
    .replace(/停車場|停車|站|停管處/g, "")
    .replace(/\s+/g, "")
    .toLowerCase();
}

export function mergeParkingLots(pages: NormalizedParkingLot[][]) {
  const merged: NormalizedParkingLot[] = [];
  for (const lot of pages.flat()) {
    const name = normalizeName(lot.name);
    const index = merged.findIndex((item) => {
      if (item.id === lot.id) return true;
      const meters =
        distanceKm(
          { lat: item.latitude, lng: item.longitude },
          { lat: lot.latitude, lng: lot.longitude },
        ) * 1000;
      if (meters > 80) return false;
      const other = normalizeName(item.name);
      return !name || !other || name === other || name.includes(other) || other.includes(name);
    });
    if (index < 0) {
      merged.push(lot);
      continue;
    }
    if (lotScore(lot) > lotScore(merged[index])) {
      merged[index] = lot;
    }
  }
  return merged;
}
