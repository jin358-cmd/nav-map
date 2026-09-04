import type { GeocodeHit } from "@/types/domain";

const STORAGE_KEY = "navpilot.favorites.v1";
const LEGACY_STORAGE_KEYS = [
  "smart-road-taiwan.favorites.v1",
  "navpilot.favorites",
  "navpilot.bookmarks.v1",
  "smart-road-taiwan.bookmarks.v1",
];
const CHANGE_EVENT = "navpilot-favorites";
const MAX_ITEMS = 16;
const EMPTY: GeocodeHit[] = [];

let cachedRaw: string | null | undefined;
let cached = EMPTY;
let legacyHydrated = false;

function isGeocodeHit(value: unknown): value is GeocodeHit {
  if (!value || typeof value !== "object") return false;
  const hit = value as Partial<GeocodeHit>;
  return Boolean(
    typeof hit.id === "string" &&
      typeof hit.name === "string" &&
      typeof hit.address === "string" &&
      hit.location &&
      Number.isFinite(hit.location.lng) &&
      Number.isFinite(hit.location.lat),
  );
}

function placeKey(hit: Pick<GeocodeHit, "name" | "location">) {
  return `${hit.name.replaceAll("臺", "台")}|${hit.location.lng.toFixed(5)}|${hit.location.lat.toFixed(5)}`;
}

function readStored(raw: string | null) {
  if (!raw) return EMPTY;
  try {
    const value = JSON.parse(raw) as unknown;
    if (!Array.isArray(value)) return EMPTY;
    return value.filter(isGeocodeHit).slice(0, MAX_ITEMS);
  } catch {
    return EMPTY;
  }
}

function readLegacyHits() {
  const hits: GeocodeHit[] = [];
  for (const key of LEGACY_STORAGE_KEYS) {
    try {
      hits.push(...readStored(window.localStorage.getItem(key)));
    } catch {
      /* 舊 key 讀取失敗時保留現有資料 */
    }
  }
  return hits;
}

function hydrateLegacyFavorites(current: GeocodeHit[]) {
  if (legacyHydrated || typeof window === "undefined") return current;
  legacyHydrated = true;
  const merged = new Map<string, GeocodeHit>();
  for (const item of [...current, ...readLegacyHits()]) {
    const key = placeKey(item);
    if (!merged.has(key)) merged.set(key, item);
  }
  const next = [...merged.values()].slice(0, MAX_ITEMS);
  if (next.length === current.length) return current;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    return next;
  }
  cachedRaw = undefined;
  return next;
}

export function getFavoritesSnapshot() {
  if (typeof window === "undefined") return EMPTY;
  let raw: string | null;
  try {
    raw = window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return EMPTY;
  }
  if (raw === cachedRaw && legacyHydrated) return cached;
  cachedRaw = raw;
  cached = hydrateLegacyFavorites(readStored(raw));
  return cached;
}

export function getServerFavoritesSnapshot() {
  return EMPTY;
}

export function subscribeFavorites(onChange: () => void) {
  if (typeof window === "undefined") return () => undefined;
  const handleStorage = (event: StorageEvent) => {
    if (event.key === STORAGE_KEY) onChange();
  };
  window.addEventListener("storage", handleStorage);
  window.addEventListener(CHANGE_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", handleStorage);
    window.removeEventListener(CHANGE_EVENT, onChange);
  };
}

function writeFavorites(next: GeocodeHit[]) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    return;
  }
  cachedRaw = undefined;
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

export function isFavorite(hit: Pick<GeocodeHit, "name" | "location">) {
  const key = placeKey(hit);
  return getFavoritesSnapshot().some((item) => placeKey(item) === key);
}

export function addFavorite(hit: GeocodeHit) {
  if (typeof window === "undefined") return;
  const key = placeKey(hit);
  const next = [
    hit,
    ...getFavoritesSnapshot().filter((item) => placeKey(item) !== key),
  ].slice(0, MAX_ITEMS);
  writeFavorites(next);
}

export function removeFavorite(hit: Pick<GeocodeHit, "name" | "location">) {
  if (typeof window === "undefined") return;
  const key = placeKey(hit);
  writeFavorites(getFavoritesSnapshot().filter((item) => placeKey(item) !== key));
}

export function toggleFavorite(hit: GeocodeHit) {
  if (isFavorite(hit)) {
    removeFavorite(hit);
    return false;
  }
  addFavorite(hit);
  return true;
}

export function replaceFavorites(next: GeocodeHit[]) {
  if (typeof window === "undefined") return;
  writeFavorites(next.filter(isGeocodeHit).slice(0, MAX_ITEMS));
}

export function mergeFavorites(incoming: GeocodeHit[]) {
  if (typeof window === "undefined") return;
  const byKey = new Map<string, GeocodeHit>();
  for (const item of [...getFavoritesSnapshot(), ...incoming.filter(isGeocodeHit)]) {
    const key = placeKey(item);
    if (!byKey.has(key)) byKey.set(key, item);
  }
  writeFavorites([...byKey.values()].slice(0, MAX_ITEMS));
}
