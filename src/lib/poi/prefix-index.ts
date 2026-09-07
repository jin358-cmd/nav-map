import {
  brandsForPrefix,
  matchedBrand,
  matchedCategory,
  normalizePoiKey,
} from "@/lib/poi/aliases";
import { rankPois, matchTier } from "@/lib/poi/rank";
import type { PoiCategory, TaiwanPoiRecord } from "@/lib/poi/schema";

export type PoiIndexes = {
  prefix: Map<string, TaiwanPoiRecord[]>;
  brand: Map<string, TaiwanPoiRecord[]>;
  category: Map<PoiCategory, TaiwanPoiRecord[]>;
};

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
  for (const poi of rows) {
    if (!poi.isActive) continue;
    const texts = [poi.name, poi.brand, poi.branchName, poi.address, ...poi.aliases];
    for (const text of texts) {
      if (!text) continue;
      for (const key of prefixesOf(text)) add(prefix, key, poi);
    }
    if (poi.brand) add(brand, poi.brand, poi);
    const bucket = category.get(poi.category);
    if (bucket) bucket.push(poi);
    else category.set(poi.category, [poi]);
  }
  return { prefix, brand, category };
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

export function lookupIndexedPois(
  indexes: PoiIndexes,
  query: string,
): { prefix: TaiwanPoiRecord[]; aliasBrand: TaiwanPoiRecord[]; fuzzy: TaiwanPoiRecord[] } {
  const needle = normalizePoiKey(query);
  const prefixKey = needle.slice(0, Math.min(2, needle.length));
  const charKey = needle.slice(0, 1);
  const prefixRows = unique([
    ...(indexes.prefix.get(prefixKey) ?? []),
    ...(prefixKey !== charKey ? indexes.prefix.get(charKey) ?? [] : []),
  ]);

  const brandHit = matchedBrand(query);
  const categoryHit = matchedCategory(query);
  const prefixBrands = brandsForPrefix(query);
  const aliasBrand = unique([
    ...(brandHit ? indexes.brand.get(brandHit.brand) ?? [] : []),
    ...prefixBrands.flatMap((item) => indexes.brand.get(item.brand) ?? []),
    ...(categoryHit ? indexes.category.get(categoryHit.category) ?? [] : []),
  ]);

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
  const { prefix, aliasBrand, fuzzy } = lookupIndexedPois(indexes, query);
  const ranked = rankPois(unique([...prefix, ...aliasBrand, ...fuzzy]), query, origin).filter(
    (poi) => matchTier(query, poi) !== "none" || matchedCategory(query)?.category === poi.category,
  );
  const needle = normalizePoiKey(query);
  const mixed = needle.length <= 2 ? diversifyByBrand(ranked) : ranked;
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
