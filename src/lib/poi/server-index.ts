import "server-only";

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { gunzipSync } from "node:zlib";
import { distanceKm } from "@/lib/geo";
import type { GeocodeResult } from "@/lib/geocoding/types";
import { buildPoiIndexes, diversifyByBrand, searchIndexedPois } from "@/lib/poi/prefix-index";
import { POI_MAIN_LAYER_IDS, type PoiMainLayerId } from "@/lib/poi/main-layers";
import { rankPois, rankScore } from "@/lib/poi/rank";
import {
  hydratePoiRecord,
  rowToRecord,
  type TaiwanPoiRecord,
  type TaiwanPoiRow,
} from "@/lib/poi/schema";

function loadPoiPayload(): Array<Record<string, unknown>> {
  const gz = join(process.cwd(), "src/data/taiwan-poi-index.json.gz");
  const json = join(process.cwd(), "src/data/taiwan-poi-index.json");
  try {
    if (existsSync(gz)) {
      return JSON.parse(gunzipSync(readFileSync(gz)).toString("utf8")) as Array<
        Record<string, unknown>
      >;
    }
    if (existsSync(json)) {
      return JSON.parse(readFileSync(json).toString("utf8")) as Array<Record<string, unknown>>;
    }
  } catch {
    return [];
  }
  return [];
}

const MEMORY_INDEX: TaiwanPoiRecord[] = loadPoiPayload()
  .map((row) => hydratePoiRecord(row))
  .filter((row): row is TaiwanPoiRecord => Boolean(row && row.isActive));

const INDEXES = buildPoiIndexes(MEMORY_INDEX);

/** ~3 km cells so viewport queries skip the full 13万+ scan. */
const GRID_DEG = 0.03;
const SPATIAL_GRID = new Map<string, TaiwanPoiRecord[]>();

function gridCell(lat: number, lng: number) {
  return `${Math.floor(lat / GRID_DEG)}:${Math.floor(lng / GRID_DEG)}`;
}

for (const poi of MEMORY_INDEX) {
  const key = gridCell(poi.latitude, poi.longitude);
  const bucket = SPATIAL_GRID.get(key);
  if (bucket) bucket.push(poi);
  else SPATIAL_GRID.set(key, [poi]);
}

function poisInGridBounds(bounds: {
  west: number;
  south: number;
  east: number;
  north: number;
}) {
  const minLat = Math.floor(bounds.south / GRID_DEG);
  const maxLat = Math.floor(bounds.north / GRID_DEG);
  const minLng = Math.floor(bounds.west / GRID_DEG);
  const maxLng = Math.floor(bounds.east / GRID_DEG);
  const out: TaiwanPoiRecord[] = [];
  for (let lat = minLat; lat <= maxLat; lat += 1) {
    for (let lng = minLng; lng <= maxLng; lng += 1) {
      const bucket = SPATIAL_GRID.get(`${lat}:${lng}`);
      if (bucket) out.push(...bucket);
    }
  }
  return out;
}

function layerPickRank(poi: TaiwanPoiRecord) {
  if (poi.category === "convenience") return 0;
  if (poi.brand) return 1;
  return 2;
}

function supabaseConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ?? "";
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ?? "";
  if (!url || !serviceKey) return null;
  return { url: url.replace(/\/$/, ""), serviceKey };
}

export function poiIndexEnabled() {
  return MEMORY_INDEX.length > 0 || Boolean(supabaseConfig());
}

async function searchSupabasePois(
  query: string,
  origin?: { lat: number; lng: number },
  signal?: AbortSignal,
): Promise<TaiwanPoiRecord[]> {
  const config = supabaseConfig();
  if (!config) return [];
  try {
    const response = await fetch(`${config.url}/rest/v1/rpc/suggest_taiwan_pois`, {
      method: "POST",
      headers: {
        apikey: config.serviceKey,
        Authorization: `Bearer ${config.serviceKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        q: query,
        bias_lng: origin?.lng ?? null,
        bias_lat: origin?.lat ?? null,
        max_results: 24,
      }),
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

export function searchMemoryPoiIndex(
  query: string,
  origin?: { lat: number; lng: number },
  limit = 24,
): TaiwanPoiRecord[] {
  return searchIndexedPois(INDEXES, query, origin, limit);
}

export type SuggestTimings = {
  prefixMs: number;
  localMs: number;
  remoteMs: number;
  totalMs: number;
};

function toGeocode(query: string, poi: TaiwanPoiRecord, origin?: { lat: number; lng: number }): GeocodeResult {
  const score = rankScore(query, poi, origin);
  const displayName = poi.branchName ? `${poi.name} ${poi.branchName}` : poi.name;
  return {
    id: poi.id,
    label: displayName,
    formattedAddress: poi.address,
    latitude: poi.latitude,
    longitude: poi.longitude,
    source: poi.source === "osm" ? "osm" : poi.source === "overture" ? "overture" : "index",
    confidence: Math.min(0.95, 0.55 + score / 200),
    exactHouseNumber: false,
    matchKind: "landmark",
    distanceMeters: origin
      ? Math.round(distanceKm(origin, { lat: poi.latitude, lng: poi.longitude }) * 1000)
      : undefined,
    category: poi.category,
    branchName: poi.branchName,
  };
}

export async function searchTaiwanPoiIndex(
  query: string,
  origin?: { lat: number; lng: number },
  signal?: AbortSignal,
): Promise<GeocodeResult[]> {
  const { results } = await searchTaiwanPoiIndexTimed(query, origin, signal, {
    remote: true,
  });
  return results;
}

export async function searchTaiwanPoiIndexTimed(
  query: string,
  origin?: { lat: number; lng: number },
  signal?: AbortSignal,
  options: { remote?: boolean } = {},
): Promise<{ results: GeocodeResult[]; timings: SuggestTimings; localCount: number }> {
  const started = performance.now();
  if (query.trim().length < 1) {
    return {
      results: [],
      timings: { prefixMs: 0, localMs: 0, remoteMs: 0, totalMs: 0 },
      localCount: 0,
    };
  }
  const prefixStarted = performance.now();
  const local = searchMemoryPoiIndex(query, origin, 24);
  const prefixMs = performance.now() - prefixStarted;
  const localMs = prefixMs;

  const remoteStarted = performance.now();
  let remote: TaiwanPoiRecord[] = [];
  const wantRemote = options.remote === true && local.length < 8;
  if (wantRemote) {
    try {
      remote = await searchSupabasePois(query, origin, signal);
    } catch {
      remote = [];
    }
  }
  const remoteMs = performance.now() - remoteStarted;

  const merged = new Map<string, TaiwanPoiRecord>();
  for (const row of [...local, ...remote]) {
    if (!merged.has(row.id)) merged.set(row.id, row);
  }
  const combined = rankPois([...merged.values()], query, origin);
  const ranked =
    query.trim().length <= 2 ? diversifyByBrand(combined).slice(0, 24) : combined.slice(0, 24);

  return {
    results: ranked.map((poi) => toGeocode(query, poi, origin)),
    timings: {
      prefixMs: Number(prefixMs.toFixed(2)),
      localMs: Number(localMs.toFixed(2)),
      remoteMs: Number(remoteMs.toFixed(2)),
      totalMs: Number((performance.now() - started).toFixed(2)),
    },
    localCount: local.length,
  };
}

export function poisInBounds(
  bounds: { west: number; south: number; east: number; north: number },
  origin?: { lat: number; lng: number },
  limit = 80,
  layers?: PoiMainLayerId[],
) {
  const west = Math.min(bounds.west, bounds.east);
  const east = Math.max(bounds.west, bounds.east);
  const south = Math.min(bounds.south, bounds.north);
  const north = Math.max(bounds.south, bounds.north);
  const wantedLayers = layers?.length ? layers : [...POI_MAIN_LAYER_IDS];
  const wanted = new Set(wantedLayers);
  const rows = poisInGridBounds({ west, south, east, north }).filter(
    (poi) =>
      poi.longitude >= west &&
      poi.longitude <= east &&
      poi.latitude >= south &&
      poi.latitude <= north &&
      wanted.has(poi.mainCategory),
  );
  const ranked = rows
    .map((poi) => ({
      poi,
      km: origin
        ? distanceKm(origin, { lat: poi.latitude, lng: poi.longitude })
        : 0,
      pick: layerPickRank(poi),
    }))
    .sort((a, b) => a.pick - b.pick || a.km - b.km)
    .map((row) => row.poi);
  const perLayer = Math.max(
    80,
    Math.min(140, Math.ceil(Math.max(limit, 560) / wanted.size)),
  );
  const picked: TaiwanPoiRecord[] = [];
  for (const layer of wantedLayers) {
    let count = 0;
    for (const poi of ranked) {
      if (poi.mainCategory !== layer) continue;
      picked.push(poi);
      count += 1;
      if (count >= perLayer) break;
    }
  }
  return picked;
}

export function poiIndexStats() {
  const bySource = new Map<string, number>();
  const byCategory = new Map<string, number>();
  const byCity = new Map<string, number>();
  for (const row of MEMORY_INDEX) {
    bySource.set(row.source, (bySource.get(row.source) ?? 0) + 1);
    byCategory.set(row.category, (byCategory.get(row.category) ?? 0) + 1);
    byCity.set(row.city ?? "未知", (byCity.get(row.city ?? "未知") ?? 0) + 1);
  }
  return {
    total: MEMORY_INDEX.length,
    bySource: Object.fromEntries(bySource),
    byCategory: Object.fromEntries(byCategory),
    byCity: Object.fromEntries(byCity),
    supabaseConfigured: Boolean(supabaseConfig()),
  };
}
