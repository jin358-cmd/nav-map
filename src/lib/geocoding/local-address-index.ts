import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { gunzipSync } from "node:zlib";
import { comparableTaiwanText, normalizeTaiwanAddress } from "@/lib/geocoding/normalizeTaiwanAddress";
import type { GeocodeMatchKind, GeocodeResult } from "@/lib/geocoding/types";

export type LocalAddressRow = {
  n: string;
  d: string;
  lat: number;
  lng: number;
  c: string;
  t: string;
  r: string;
  s?: string;
  h: string;
  a: GeocodeMatchKind;
  k: string;
};

export type LocalAddressPayload = {
  version: string;
  source: string;
  notOfficialCountyFile: boolean;
  count: number;
  rows: LocalAddressRow[];
};

const MAX_BYTES = 20 * 1024 * 1024;

function candidatePaths() {
  const override = process.env.SOUTH_ADDRESS_INDEX?.trim();
  return [
    override,
    join(process.cwd(), "src/data/south-address-index.json.gz"),
    join(process.cwd(), "data/south-pilot/address-index.json.gz"),
  ].filter((value): value is string => Boolean(value));
}

export function localAddressIndexPath() {
  return candidatePaths().find((path) => existsSync(path)) ?? null;
}

export function localAddressIndexEnabled() {
  return Boolean(localAddressIndexPath());
}

let cached: LocalAddressPayload | null | undefined;

export function loadLocalAddressIndex(): LocalAddressPayload | null {
  if (cached !== undefined) return cached;
  const path = localAddressIndexPath();
  if (!path) {
    cached = null;
    return null;
  }
  try {
    const buf = readFileSync(path);
    if (buf.byteLength > MAX_BYTES) {
      console.warn(`[address-index] skip oversized ${path} (${buf.byteLength} bytes)`);
      cached = null;
      return null;
    }
    cached = JSON.parse(gunzipSync(buf).toString("utf8")) as LocalAddressPayload;
    return cached;
  } catch {
    cached = null;
    return null;
  }
}

export function resetLocalAddressIndexCache() {
  cached = undefined;
}

function kindRank(kind: GeocodeMatchKind) {
  if (kind === "exact-house") return 4;
  if (kind === "interpolated") return 3;
  if (kind === "lane-center") return 2;
  return 1;
}

export function searchLocalAddressRows(
  rows: LocalAddressRow[],
  query: string,
  limit = 12,
): GeocodeResult[] {
  if (!rows.length || query.trim().length < 2) return [];
  const parsed = normalizeTaiwanAddress(query);
  const needle = comparableTaiwanText(parsed.searchAddress || query);
  const county = comparableTaiwanText(parsed.parts.city);
  const road = comparableTaiwanText(parsed.parts.road);
  const house = comparableTaiwanText(parsed.parts.number ? `${parsed.parts.number}號` : "");
  const scored: Array<{ row: LocalAddressRow; score: number }> = [];

  for (const row of rows) {
    const hay = comparableTaiwanText(row.n);
    if (county && comparableTaiwanText(row.c) !== county) continue;
    let score = 0;
    if (needle && hay.includes(needle)) score += 50;
    else if (needle.length >= 6 && hay.includes(needle.slice(0, Math.min(12, needle.length)))) {
      score += 18;
    }
    if (road && comparableTaiwanText(row.r) === road) score += 20;
    if (house && comparableTaiwanText(row.h).startsWith(house.replace("號", ""))) score += 24;
    if (parsed.parts.town && comparableTaiwanText(row.t) === comparableTaiwanText(parsed.parts.town)) {
      score += 12;
    }
    if (parsed.parts.section && comparableTaiwanText(row.s || "") === comparableTaiwanText(parsed.parts.section)) {
      score += 8;
    }
    if (!score) continue;
    score += kindRank(row.a);
    scored.push({ row, score });
  }

  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((item, index) => ({
      id: `local-index-${item.row.k}-${index}`,
      label: item.row.d,
      formattedAddress: item.row.d,
      latitude: item.row.lat,
      longitude: item.row.lng,
      source: "index" as const,
      confidence: item.row.a === "exact-house" ? 0.84 : 0.6,
      exactHouseNumber: item.row.a === "exact-house",
      matchKind: item.row.a,
    }));
}

export function searchLocalAddressIndex(query: string, limit = 12): GeocodeResult[] {
  const payload = loadLocalAddressIndex();
  if (!payload?.rows?.length) return [];
  return searchLocalAddressRows(payload.rows, query, limit);
}
