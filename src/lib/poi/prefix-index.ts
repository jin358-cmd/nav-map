import {
  brandsForPrefix,
  matchedBrand,
  matchedCategory,
  nameFitsBrand,
  normalizePoiKey,
} from "@/lib/poi/aliases";
import { encodeGeohash, nearbyGeohashes } from "@/lib/poi/geohash";
import { classifyPoiQuery, prefersNearby } from "@/lib/poi/intent";
import { rankPois, matchTier } from "@/lib/poi/rank";
import type { PoiCategory, TaiwanPoiRecord } from "@/lib/poi/schema";

export type PoiIndexes = {
  prefix: Map<string, TaiwanPoiRecord[]>;
  brand: Map<string, TaiwanPoiRecord[]>;
  category: Map<PoiCategory, TaiwanPoiRecord[]>;
  geo4: Map<string, TaiwanPoiRecord[]>;
  geo5: Map<string, TaiwanPoiRecord[]>;
};

const PREFIX_CANDIDATE_CAP = 480;
const NEARBY_MIN_POOL = 80;

function add(map: Map<string, TaiwanPoiRecord[]>, key: string, poi: TaiwanPoiRecord) {
  if (!key) return;
  const list = map.get(key);
  if (list) list.push(poi);
  else map.set(key, [poi]);
}

function prefixesOf(value: string) {
  const needle = normalizePoiKey(value);
  const keys: string[] = [];
  if (needle.length >= 1) keys.push(needle.slice(0, 1));
  if (needle.length >= 2) keys.push(needle.slice(0, 2));
  return keys;
}

export function buildPoiIndexes(rows: TaiwanPoiRecord[]): PoiIndexes {
  const prefix = new Map<string, TaiwanPoiRecord[]>();
  const brand = new Map<string, TaiwanPoiRecord[]>();
  const category = new Map<PoiCategory, TaiwanPoiRecord[]>();
  const geo4 = new Map<string, TaiwanPoiRecord[]>();
  const geo5 = new Map<string, TaiwanPoiRecord[]>();
  for (const poi of rows) {
    if (!poi.isActive) continue;
    const texts = [poi.name, poi.brand, poi.branchName, ...poi.aliases];
    for (const text of texts) {
      if (!text) continue;
      for (const key of prefixesOf(text)) add(prefix, key, poi);
    }
    if (poi.brand) add(brand, poi.brand, poi);
    const bucket = category.get(poi.category);
    if (bucket) bucket.push(poi);
    else category.set(poi.category, [poi]);
    add(geo4, encodeGeohash(poi.latitude, poi.longitude, 4), poi);
    add(geo5, encodeGeohash(poi.latitude, poi.longitude, 5), poi);
  }
  return { prefix, brand, category, geo4, geo5 };
}

function unique(rows: TaiwanPoiRecord[]) {
  const seen = new Set<string>();
  const out: TaiwanPoiRecord[] = [];
  for (const row of rows) {
    if (seen.has(row.id)) continue;
    seen.add(row.id);
    out.push(row);
  }
  return out;
}

function fromCells(
  index: Map<string, TaiwanPoiRecord[]>,
  lat: number,
  lng: number,
  precision: 4 | 5,
) {
  return unique(nearbyGeohashes(lat, lng, precision).flatMap((cell) => index.get(cell) ?? []));
}

function nearbyPool(
  indexes: PoiIndexes,
  origin: { lat: number; lng: number },
) {
  const tight = fromCells(indexes.geo5, origin.lat, origin.lng, 5);
  if (tight.length >= NEARBY_MIN_POOL) return tight;
  return fromCells(indexes.geo4, origin.lat, origin.lng, 4);
}

export function lookupIndexedPois(
  indexes: PoiIndexes,
  query: string,
  origin?: { lat: number; lng: number },
): { prefix: TaiwanPoiRecord[]; aliasBrand: TaiwanPoiRecord[]; fuzzy: TaiwanPoiRecord[] } {
  const needle = normalizePoiKey(query);
  const prefixKey = needle.slice(0, Math.min(2, needle.length));
  const charKey = needle.slice(0, 1);
  const intent = classifyPoiQuery(query);
  const localFirst = Boolean(origin && prefersNearby(intent));
  const spatial = origin && localFirst ? nearbyPool(indexes, origin) : null;
  const spatialIds = spatial ? new Set(spatial.map((row) => row.id)) : null;

  const rawPrefix = unique([
    ...(indexes.prefix.get(prefixKey) ?? []),
    ...(prefixKey !== charKey ? indexes.prefix.get(charKey) ?? [] : []),
  ]);
  const prefixRows = (spatialIds ? rawPrefix.filter((row) => spatialIds.has(row.id)) : rawPrefix).slice(
    0,
    PREFIX_CANDIDATE_CAP,
  );

  const brandHit = matchedBrand(query);
  const categoryHit = matchedCategory(query);
  const prefixBrands = brandsForPrefix(query);
  let aliasBrand = unique([
    ...(brandHit ? indexes.brand.get(brandHit.brand) ?? [] : []),
    ...prefixBrands.flatMap((item) => indexes.brand.get(item.brand) ?? []),
    ...(categoryHit ? indexes.category.get(categoryHit.category) ?? [] : []),
  ]);
  if (spatialIds && localFirst) {
    const nearbyHits = aliasBrand.filter((row) => spatialIds.has(row.id));
    if (nearbyHits.length >= 8) aliasBrand = nearbyHits;
    else aliasBrand = aliasBrand.slice(0, PREFIX_CANDIDATE_CAP);
  } else {
    aliasBrand = aliasBrand.slice(0, PREFIX_CANDIDATE_CAP);
  }

  const fuzzy = prefixRows.filter((poi) => {
    const tier = matchTier(query, poi);
    return tier === "fuzzy" || tier === "prefix" || tier === "exact" || tier === "alias";
  });

  return { prefix: prefixRows, aliasBrand, fuzzy };
}

export function searchIndexedPois(
  indexes: PoiIndexes,
  query: string,
  origin?: { lat: number; lng: number },
  limit = 24,
) {
  const { prefix, aliasBrand, fuzzy } = lookupIndexedPois(indexes, query, origin);
  const ranked = rankPois(unique([...prefix, ...aliasBrand, ...fuzzy]), query, origin).filter(
    (poi) => matchTier(query, poi) !== "none" || matchedCategory(query)?.category === poi.category,
  );
  const needle = normalizePoiKey(query);
  const sevenEleven = /^\d{1,3}$/.test(needle)
    ? brandsForPrefix(query).find((item) => item.brand === "7-Eleven")
    : null;
  const cleaned = sevenEleven
    ? ranked.filter(
        (poi) => poi.brand === "7-Eleven" || nameFitsBrand(poi.name, "7-Eleven"),
      )
    : ranked;
  const mixed = needle.length <= 2 ? diversifyByBrand(cleaned) : cleaned;
  return mixed.slice(0, limit);
}

export function diversifyByBrand(rows: TaiwanPoiRecord[]) {
  const used = new Map<string, number>();
  const first: TaiwanPoiRecord[] = [];
  const rest: TaiwanPoiRecord[] = [];
  for (const row of rows) {
    const key = row.brand || row.nameNormalized.slice(0, 2);
    const count = used.get(key) ?? 0;
    if (count < 2) {
      first.push(row);
      used.set(key, count + 1);
    } else {
      rest.push(row);
    }
  }
  return [...first, ...rest];
}
