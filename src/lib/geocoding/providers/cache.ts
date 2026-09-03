import "server-only";

import { queryHash } from "@/lib/geocoding/normalizeTaiwanAddress";
import type { GeocodeResult } from "@/lib/geocoding/types";

const memory = new Map<
  string,
  { results: GeocodeResult[]; expiresAt: number; hitCount: number }
>();

const EXACT_TTL_MS = 14 * 24 * 60 * 60 * 1000;
const FUZZY_TTL_MS = 6 * 60 * 60 * 1000;

function supabaseConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ?? "";
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ?? "";
  if (!url || !serviceKey) return null;
  return { url: url.replace(/\/$/, ""), serviceKey };
}

export function cacheProviderEnabled() {
  return true;
}

function ttlFor(results: GeocodeResult[]) {
  return results.some((item) => item.exactHouseNumber)
    ? EXACT_TTL_MS
    : FUZZY_TTL_MS;
}

function isFresh(expiresAt: number) {
  return expiresAt > Date.now();
}

async function supabaseGet(hash: string): Promise<GeocodeResult[] | null> {
  const config = supabaseConfig();
  if (!config) return null;
  try {
    const response = await fetch(
      `${config.url}/rest/v1/address_search_cache?query_hash=eq.${encodeURIComponent(hash)}&select=response_data,expires_at,hit_count`,
      {
        headers: {
          apikey: config.serviceKey,
          Authorization: `Bearer ${config.serviceKey}`,
        },
        cache: "no-store",
      },
    );
    if (!response.ok) return null;
    const rows = (await response.json()) as Array<{
      response_data?: { results?: GeocodeResult[] };
      expires_at?: string;
      hit_count?: number;
    }>;
    const row = rows[0];
    if (!row?.expires_at || !isFresh(Date.parse(row.expires_at))) return null;
    const results = row.response_data?.results;
    return Array.isArray(results) ? results : null;
  } catch {
    return null;
  }
}

async function supabasePut(
  hash: string,
  originalQuery: string,
  normalizedQuery: string,
  results: GeocodeResult[],
) {
  const config = supabaseConfig();
  if (!config) return;
  const expiresAt = new Date(Date.now() + ttlFor(results)).toISOString();
  try {
    await fetch(`${config.url}/rest/v1/address_search_cache`, {
      method: "POST",
      headers: {
        apikey: config.serviceKey,
        Authorization: `Bearer ${config.serviceKey}`,
        "Content-Type": "application/json",
        Prefer: "resolution=merge-duplicates",
      },
      body: JSON.stringify({
        query_hash: hash,
        original_query: originalQuery,
        normalized_query: normalizedQuery,
        response_data: { results },
        primary_source: results[0]?.source ?? null,
        expires_at: expiresAt,
        updated_at: new Date().toISOString(),
      }),
    });
  } catch {
    /* 快取寫入失敗不影響搜尋 */
  }
}

async function supabaseTouch(hash: string) {
  const config = supabaseConfig();
  if (!config) return;
  try {
    const current = await fetch(
      `${config.url}/rest/v1/address_search_cache?query_hash=eq.${encodeURIComponent(hash)}&select=hit_count`,
      {
        headers: {
          apikey: config.serviceKey,
          Authorization: `Bearer ${config.serviceKey}`,
        },
        cache: "no-store",
      },
    );
    if (!current.ok) return;
    const rows = (await current.json()) as Array<{ hit_count?: number }>;
    const next = (rows[0]?.hit_count ?? 0) + 1;
    await fetch(
      `${config.url}/rest/v1/address_search_cache?query_hash=eq.${encodeURIComponent(hash)}`,
      {
        method: "PATCH",
        headers: {
          apikey: config.serviceKey,
          Authorization: `Bearer ${config.serviceKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          hit_count: next,
          updated_at: new Date().toISOString(),
        }),
      },
    );
  } catch {
    /* 計數失敗可忽略 */
  }
}

export async function readAddressCache(
  normalizedQuery: string,
  biasKey = "",
): Promise<GeocodeResult[] | null> {
  const hash = queryHash(normalizedQuery, biasKey);
  const local = memory.get(hash);
  if (local && isFresh(local.expiresAt)) {
    local.hitCount += 1;
    return local.results;
  }
  if (local) memory.delete(hash);

  const remote = await supabaseGet(hash);
  if (remote) {
    memory.set(hash, {
      results: remote,
      expiresAt: Date.now() + ttlFor(remote),
      hitCount: 1,
    });
    return remote;
  }
  return null;
}

export async function writeAddressCache(
  originalQuery: string,
  normalizedQuery: string,
  results: GeocodeResult[],
  biasKey = "",
) {
  const cacheable = results.filter((item) => item.source !== "google");
  if (!cacheable.length) return;
  const hash = queryHash(normalizedQuery, biasKey);
  memory.set(hash, {
    results: cacheable,
    expiresAt: Date.now() + ttlFor(cacheable),
    hitCount: 0,
  });
  await supabasePut(hash, originalQuery, normalizedQuery, cacheable);
}

export async function rememberAddressCacheHit(
  normalizedQuery: string,
  biasKey = "",
) {
  const hash = queryHash(normalizedQuery, biasKey);
  const local = memory.get(hash);
  if (local) local.hitCount += 1;
  await supabaseTouch(hash);
}
