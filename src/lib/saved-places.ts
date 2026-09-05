import { formatTaiwanDisplayAddress } from "@/lib/geocoding/format-taiwan-display-address";
import type { SavedPlace, SavedPlaceType } from "@/types/domain";

const STORAGE_KEY = "navpilot.saved-places.v1";
const CHANGE_EVENT = "navpilot-saved-places";

const EMPTY: SavedPlace[] = [];
let cachedRaw: string | null | undefined;
let cached = EMPTY;

function isSavedPlace(value: unknown): value is SavedPlace {
  if (!value || typeof value !== "object") return false;
  const place = value as Partial<SavedPlace>;
  return (
    typeof place.id === "string" &&
    (place.type === "home" || place.type === "work" || place.type === "custom") &&
    typeof place.displayName === "string" &&
    Number.isFinite(place.latitude) &&
    Number.isFinite(place.longitude) &&
    typeof place.createdAt === "string" &&
    typeof place.updatedAt === "string"
  );
}

function readStored(raw: string | null) {
  if (!raw) return EMPTY;
  try {
    const value = JSON.parse(raw) as unknown;
    return Array.isArray(value) ? value.filter(isSavedPlace) : EMPTY;
  } catch {
    return EMPTY;
  }
}

function write(places: SavedPlace[]) {
  cached = places;
  cachedRaw = JSON.stringify(places);
  try {
    window.localStorage.setItem(STORAGE_KEY, cachedRaw);
  } catch {
    /* 私人儲存失敗時仍保留記憶體副本 */
  }
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

export function getSavedPlacesSnapshot() {
  if (typeof window === "undefined") return EMPTY;
  let raw: string | null;
  try {
    raw = window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return cached;
  }
  if (raw === cachedRaw) return cached;
  cachedRaw = raw;
  cached = readStored(raw);
  return cached;
}

export function getServerSavedPlacesSnapshot() {
  return EMPTY;
}

export function subscribeSavedPlaces(onChange: () => void) {
  window.addEventListener(CHANGE_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(CHANGE_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

export function getSavedPlaceByType(type: SavedPlaceType) {
  return getSavedPlacesSnapshot().find((place) => place.type === type) ?? null;
}

export function upsertSavedPlace(
  input: Omit<SavedPlace, "id" | "createdAt" | "updatedAt"> & { id?: string },
) {
  const now = new Date().toISOString();
  const current = getSavedPlacesSnapshot();
  const existing = input.id
    ? current.find((place) => place.id === input.id)
    : current.find((place) => place.type === input.type && place.type !== "custom");
  const next: SavedPlace = {
    id: existing?.id ?? input.id ?? crypto.randomUUID(),
    type: input.type,
    displayName: input.displayName,
    originalAddress: input.originalAddress,
    latitude: input.latitude,
    longitude: input.longitude,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };
  const others = current.filter((place) => place.id !== next.id);
  if (next.type !== "custom") {
    write([next, ...others.filter((place) => place.type !== next.type)]);
    return next;
  }
  write([next, ...others]);
  return next;
}

export function renameSavedPlace(id: string, displayName: string) {
  const name = displayName.trim();
  if (!name) return;
  write(
    getSavedPlacesSnapshot().map((place) =>
      place.id === id
        ? { ...place, displayName: name, updatedAt: new Date().toISOString() }
        : place,
    ),
  );
}

export function deleteSavedPlace(id: string) {
  write(getSavedPlacesSnapshot().filter((place) => place.id !== id));
}

export function savedPlaceToHit(place: SavedPlace) {
  return {
    id: place.id,
    name: place.displayName,
    address: formatTaiwanDisplayAddress(
      place.originalAddress ?? place.displayName,
    ),
    location: { lng: place.longitude, lat: place.latitude },
    source: "local" as const,
  };
}
