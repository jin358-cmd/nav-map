import "server-only";

import { encodeGeohash } from "@/lib/poi/geohash";
import type { GeocodeResult } from "@/lib/geocoding/types";

export const SUGGEST_CACHE_VERSION = "poi-suggest-11";
const HOT_TTL_MS = 10 * 60 * 1000;
const HOT_QUERIES = new Set(
  [
    "全",
    "全家",
    "全聯",
    "7",
    "7-11",
    "711",
    "7-eleven",
    "星",
    "星巴克",
    "麥",
    "麥當勞",
    "加",
    "加油站",
    "停",
    "停車場",
    "藥",
    "藥局",
    "醫",
    "醫院",
    "海",
  ].map((item) => item.toLowerCase().replaceAll("臺", "台").replace(/[\s\-]/g, "")),
);

type Entry = { results: GeocodeResult[]; expiresAt: number };

const memory = new Map<string, Entry>();

function compactQuery(query: string) {
  return query.toLowerCase().replaceAll("臺", "台").replace(/[\s\-_.＋+]/g, "");
}

export function suggestCacheKey(
  query: string,
  origin?: { lat: number; lng: number } | null,
) {
  const region = origin ? encodeGeohash(origin.lat, origin.lng) : "na";
  return `${SUGGEST_CACHE_VERSION}|${compactQuery(query)}|${region}`;
}

export function isHotSuggestQuery(query: string) {
  return HOT_QUERIES.has(compactQuery(query));
}

export function readSuggestCache(key: string): GeocodeResult[] | null {
  const row = memory.get(key);
  if (!row) return null;
  if (row.expiresAt <= Date.now()) {
    memory.delete(key);
    return null;
  }
  return row.results;
}

export function writeSuggestCache(key: string, results: GeocodeResult[]) {
  memory.set(key, { results, expiresAt: Date.now() + HOT_TTL_MS });
}
