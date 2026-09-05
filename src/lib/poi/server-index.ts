import "server-only";

import taiwanPoiIndex from "@/data/taiwan-poi-index.json";
import { distanceKm } from "@/lib/geo";
import {
  expandPoiQueries,
  matchedBrand,
  matchedCategory,
  matchedExactPlace,
  normalizePoiKey,
} from "@/lib/poi/aliases";
import { classifyPoiQuery, prefersNearby } from "@/lib/poi/intent";
import type { TaiwanPoiRecord, TaiwanPoiRow } from "@/lib/poi/schema";
import type { GeocodeResult } from "@/lib/geocoding/types";

const MEMORY_INDEX: TaiwanPoiRecord[] = (taiwanPoiIndex as TaiwanPoiRecord[]).filter(
  (row) => Number.isFinite(row.latitude) && Number.isFinite(row.longitude),
);

function supabaseConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ?? "";
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ?? "";
  if (!url || !serviceKey) return null;
  return { url: url.replace(/\/$/, ""), serviceKey };
}

export function poiIndexEnabled() {
  return MEMORY_INDEX.length > 0 || Boolean(supabaseConfig());
}

function rowToRecord(row: TaiwanPoiRow): TaiwanPoiRecord {
  return {
    id: row.id,
    name: row.name,
    nameNormalized: row.name_normalized,
    aliases: row.aliases ?? [],
    category: row.category,
    brand: row.brand,
    address: row.address,
    county: row.county,
    district: row.district,
    latitude: row.latitude,
    longitude: row.longitude,
    source: row.source,
    sourceId: row.source_id,
    updatedAt: row.updated_at,
    license: row.license,
  };
}

async function searchSupabasePois(
  query: string,
  origin?: { lat: number; lng: number },
  signal?: AbortSignal,
): Promise<TaiwanPoiRecord[]> {
  const config = supabaseConfig();
  if (!config) return [];
  const params = new URLSearchParams({
    select:
      "id,name,name_normalized,aliases,category,brand,address,county,district,latitude,longitude,source,source_id,updated_at,license",
    limit: "24",
  });
  const needle = query.trim();
  params.set("or", `(name.ilike.*${needle}*,address.ilike.*${needle}*,name_normalized.ilike.*${normalizePoiKey(needle)}*)`);
  try {
    const response = await fetch(`${config.url}/rest/v1/taiwan_poi_index?${params}`, {
      headers: {
        apikey: config.serviceKey,
        Authorization: `Bearer ${config.serviceKey}`,
      },
      cache: "no-store",
      signal,
    });
    if (!response.ok) return [];
    const rows = (await response.json()) as TaiwanPoiRow[];
    return rows.map(rowToRecord);
  } catch {
    return [];
  }
}

function scorePoi(query: string, poi: TaiwanPoiRecord) {
  const variants = expandPoiQueries(query).map(normalizePoiKey);
  const hay = normalizePoiKey(`${poi.name} ${poi.address} ${poi.aliases.join(" ")} ${poi.brand ?? ""}`);
  let best = 0;
  for (const needle of variants) {
    if (!needle) continue;
    if (hay === needle) best = Math.max(best, 12);
    else if (hay.startsWith(needle) || needle.startsWith(hay)) best = Math.max(best, 8);
    else if (hay.includes(needle)) best = Math.max(best, 6);
  }
  for (const token of query.trim().split(/\s+/).map(normalizePoiKey).filter((item) => item.length >= 2)) {
    if (hay.includes(token)) best = Math.max(best, best + 1);
  }
  const brand = matchedBrand(query);
  if (brand && (poi.brand === brand.brand || hay.includes(normalizePoiKey(brand.brand)))) {
    best = Math.max(best, 9);
  }
  const category = matchedCategory(query);
  if (category && poi.category === category.category) {
    best = Math.max(best, 7);
  }
  const exact = matchedExactPlace(query);
  if (exact && exact.names.some((name) => hay.includes(normalizePoiKey(name)))) {
    best = Math.max(best, 14);
  }
  return best;
}

function matchesQuery(query: string, poi: TaiwanPoiRecord) {
  const hay = normalizePoiKey(`${poi.name} ${poi.address} ${poi.aliases.join(" ")} ${poi.brand ?? ""} ${poi.category}`);
  const tokens = query
    .trim()
    .split(/\s+/)
    .map(normalizePoiKey)
    .filter((token) => token.length >= 2);
  if (tokens.length >= 2) {
    const allTokens = tokens.every((token) => {
      const expanded = expandPoiQueries(token).map(normalizePoiKey);
      return expanded.some((item) => item && hay.includes(item));
    });
    if (allTokens) return true;
  }
  return scorePoi(query, poi) >= 6;
}

export function searchMemoryPoiIndex(
  query: string,
  origin?: { lat: number; lng: number },
  limit = 24,
): TaiwanPoiRecord[] {
  const intent = classifyPoiQuery(query);
  const nearby = Boolean(origin && prefersNearby(intent));
  const rows = MEMORY_INDEX.filter((poi) => matchesQuery(query, poi));
  rows.sort((a, b) => {
    const scoreDelta = scorePoi(query, b) - scorePoi(query, a);
    if (!nearby || !origin) {
      if (scoreDelta !== 0) return scoreDelta;
      if (!origin) return a.name.localeCompare(b.name, "zh-Hant");
    } else if (scoreDelta >= 4) {
      return scoreDelta;
    }
    if (origin) {
      const da = distanceKm(origin, { lat: a.latitude, lng: a.longitude });
      const db = distanceKm(origin, { lat: b.latitude, lng: b.longitude });
      if (da !== db) return da - db;
    }
    return scoreDelta;
  });
  return rows.slice(0, limit);
}

export async function searchTaiwanPoiIndex(
  query: string,
  origin?: { lat: number; lng: number },
  signal?: AbortSignal,
): Promise<GeocodeResult[]> {
  if (query.trim().length < 1) return [];
  let remote: TaiwanPoiRecord[] = [];
  try {
    remote = await searchSupabasePois(query, origin, signal);
  } catch {
    remote = [];
  }
  const local = searchMemoryPoiIndex(query, origin, 24);
  const merged = new Map<string, TaiwanPoiRecord>();
  for (const row of [...local, ...remote]) {
    const key = `${row.source}:${row.sourceId}`;
    if (!merged.has(key)) merged.set(key, row);
  }
  const ranked = searchMemoryPoiIndex(query, origin, 48);
  const byId = new Map(ranked.map((row) => [row.id, row]));
  const combined = [
    ...ranked,
    ...[...merged.values()].filter((row) => !byId.has(row.id)),
  ];
  const intent = classifyPoiQuery(query);
  const nearby = Boolean(origin && prefersNearby(intent));
  return combined
    .filter((poi) => matchesQuery(query, poi))
    .sort((a, b) => {
      const scoreDelta = scorePoi(query, b) - scorePoi(query, a);
      if (nearby && origin && scoreDelta < 4) {
        return (
          distanceKm(origin, { lat: a.latitude, lng: a.longitude }) -
          distanceKm(origin, { lat: b.latitude, lng: b.longitude })
        );
      }
      if (scoreDelta !== 0) return scoreDelta;
      if (origin) {
        return (
          distanceKm(origin, { lat: a.latitude, lng: a.longitude }) -
          distanceKm(origin, { lat: b.latitude, lng: b.longitude })
        );
      }
      return 0;
    })
    .slice(0, 24)
    .map((poi) => ({
      id: poi.id,
      label: poi.name,
      formattedAddress: poi.address,
      latitude: poi.latitude,
      longitude: poi.longitude,
      source: poi.source === "osm" ? "osm" : poi.source === "overture" ? "overture" : "local",
      confidence: scorePoi(query, poi) >= 12 ? 0.9 : 0.72,
      exactHouseNumber: false,
      matchKind: "landmark" as const,
      distanceMeters: origin
        ? Math.round(distanceKm(origin, { lat: poi.latitude, lng: poi.longitude }) * 1000)
        : undefined,
    }));
}

export function poiIndexStats() {
  const bySource = new Map<string, number>();
  for (const row of MEMORY_INDEX) {
    bySource.set(row.source, (bySource.get(row.source) ?? 0) + 1);
  }
  return {
    total: MEMORY_INDEX.length,
    bySource: Object.fromEntries(bySource),
    supabaseConfigured: Boolean(supabaseConfig()),
  };
}
