import type { GeocodeHit } from "@/types/domain";

const STORAGE_KEY = "smart-road-taiwan.address-history.v1";
const CHANGE_EVENT = "smart-road-address-history";
const MAX_ITEMS = 10;
const EMPTY_HISTORY: GeocodeHit[] = [];

let cachedRaw: string | null | undefined;
let cachedHistory = EMPTY_HISTORY;

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

function readStoredHistory(raw: string | null) {
  if (!raw) return EMPTY_HISTORY;
  try {
    const value = JSON.parse(raw) as unknown;
    if (!Array.isArray(value)) return EMPTY_HISTORY;
    return value.filter(isGeocodeHit).slice(0, MAX_ITEMS);
  } catch {
    return EMPTY_HISTORY;
  }
}

export function getAddressHistorySnapshot() {
  if (typeof window === "undefined") return EMPTY_HISTORY;
  let raw: string | null;
  try {
    raw = window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return EMPTY_HISTORY;
  }
  if (raw === cachedRaw) return cachedHistory;
  cachedRaw = raw;
  cachedHistory = readStoredHistory(raw);
  return cachedHistory;
}

export function getServerAddressHistorySnapshot() {
  return EMPTY_HISTORY;
}

export function subscribeAddressHistory(onChange: () => void) {
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

export function rememberAddress(hit: GeocodeHit) {
  if (typeof window === "undefined") return;
  const history = getAddressHistorySnapshot();
  const key = `${hit.name.replaceAll("臺", "台")}|${hit.location.lng.toFixed(5)}|${hit.location.lat.toFixed(5)}`;
  const next = [
    hit,
    ...history.filter((item) => {
      const itemKey = `${item.name.replaceAll("臺", "台")}|${item.location.lng.toFixed(5)}|${item.location.lat.toFixed(5)}`;
      return itemKey !== key;
    }),
  ].slice(0, MAX_ITEMS);
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    return;
  }
  cachedRaw = undefined;
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

export function clearAddressHistory() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    return;
  }
  cachedRaw = undefined;
  window.dispatchEvent(new Event(CHANGE_EVENT));
}
