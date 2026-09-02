import { promises as fs } from "node:fs";
import path from "node:path";
import type { GeocodeHit } from "@/types/domain";

const STORE_PATH = path.join("/tmp", "navpilot-cloud-bookmarks.json");
const MAX_ITEMS = 16;

type Store = Record<string, GeocodeHit[]>;

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

async function readStore(): Promise<Store> {
  try {
    const raw = await fs.readFile(STORE_PATH, "utf8");
    const parsed = JSON.parse(raw) as Store;
    if (!parsed || typeof parsed !== "object") return {};
    return parsed;
  } catch {
    return {};
  }
}

async function writeStore(store: Store) {
  await fs.writeFile(STORE_PATH, JSON.stringify(store), "utf8");
}

export function sanitizeFavorites(value: unknown): GeocodeHit[] {
  if (!Array.isArray(value)) return [];
  return value.filter(isGeocodeHit).slice(0, MAX_ITEMS);
}

export async function readCloudFavorites(sub: string) {
  const store = await readStore();
  return sanitizeFavorites(store[sub]);
}

export async function writeCloudFavorites(sub: string, favorites: GeocodeHit[]) {
  const store = await readStore();
  store[sub] = sanitizeFavorites(favorites);
  await writeStore(store);
}
