import "server-only";

import { SOUTH_POI_DATA_VERSION } from "@/lib/poi/south-pilot";
import type { PoiMainLayerId } from "@/lib/poi/main-layers";
import { rowToRecord, type TaiwanPoiRecord, type TaiwanPoiRow } from "@/lib/poi/schema";

function readConfig() {
  const url = (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "").replace(
    /\/$/,
    "",
  );
  const key =
    process.env.SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    "";
  if (!url || !key) return null;
  return { url, key };
}

export async function fetchSouthPoisInBounds(query: {
  west: number;
  south: number;
  east: number;
  north: number;
  layers?: PoiMainLayerId[];
  limit: number;
}): Promise<{ pois: TaiwanPoiRecord[]; origin: "supabase" } | null> {
  const config = readConfig();
  if (!config) return null;
  try {
    const response = await fetch(`${config.url}/rest/v1/rpc/pois_in_bounds`, {
      method: "POST",
      headers: {
        apikey: config.key,
        Authorization: `Bearer ${config.key}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        west: query.west,
        south: query.south,
        east: query.east,
        north: query.north,
        layers: query.layers ?? null,
        max_results: query.limit,
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) return null;
    const rows = (await response.json()) as TaiwanPoiRow[];
    if (!Array.isArray(rows)) return null;
    return {
      origin: "supabase",
      pois: rows.map(rowToRecord).filter(Boolean) as TaiwanPoiRecord[],
    };
  } catch {
    return null;
  }
}

export function southPoiMeta(origin: "supabase" | "local-index") {
  return {
    source: origin,
    dataVersion: SOUTH_POI_DATA_VERSION,
    updatedAt: SOUTH_POI_DATA_VERSION,
  };
}
