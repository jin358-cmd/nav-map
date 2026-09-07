import { distanceKm } from "@/lib/geo";
import {
  brandsForPrefix,
  expandPoiQueries,
  matchedBrand,
  matchedCategory,
  matchedExactPlace,
  normalizePoiKey,
} from "@/lib/poi/aliases";
import { classifyPoiQuery, prefersNearby } from "@/lib/poi/intent";
import type { TaiwanPoiRecord } from "@/lib/poi/schema";

export type MatchTier =
  | "exact"
  | "prefix"
  | "alias"
  | "brand"
  | "fuzzy"
  | "category"
  | "none";

const TIER_SCORE: Record<MatchTier, number> = {
  exact: 100,
  prefix: 90,
  alias: 80,
  brand: 70,
  fuzzy: 60,
  category: 40,
  none: 0,
};

export function matchTier(query: string, poi: TaiwanPoiRecord): MatchTier {
  const needle = normalizePoiKey(query);
  if (!needle || !poi.isActive) return "none";
  const name = poi.nameNormalized || normalizePoiKey(poi.name);
  const brand = normalizePoiKey(poi.brand ?? "");
  const branch = normalizePoiKey(poi.branchName ?? "");
  const aliases = poi.aliases.map(normalizePoiKey).filter(Boolean);
  const variants = expandPoiQueries(query).map(normalizePoiKey);

  if (name === needle || brand === needle || branch === needle) return "exact";
  if (aliases.includes(needle) || variants.includes(name)) return "exact";

  if (
    name.startsWith(needle) ||
    brand.startsWith(needle) ||
    branch.startsWith(needle)
  ) {
    return "prefix";
  }
  if (
    aliases.some((alias) => {
      if (!alias) return false;
      if (alias.length <= 3 || /^\d+$/.test(alias)) {
        return alias === needle || alias.startsWith(needle);
      }
      return alias.startsWith(needle) || (needle.length >= 4 && needle.startsWith(alias));
    })
  ) {
    return "alias";
  }

  if (needle.length <= 2 && poi.brand) {
    const prefixed = brandsForPrefix(query);
    if (prefixed.some((item) => item.brand === poi.brand)) return "brand";
  }

  const brandHit = matchedBrand(query);
  if (
    brandHit &&
    (poi.brand === brandHit.brand ||
      name.includes(normalizePoiKey(brandHit.brand)) ||
      aliases.some((alias) => alias.includes(normalizePoiKey(brandHit.brand))))
  ) {
    return "brand";
  }

  if (name.includes(needle) || brand.includes(needle) || aliases.some((alias) => alias.includes(needle))) {
    return "fuzzy";
  }

  const categoryHit = matchedCategory(query);
  if (categoryHit && poi.category === categoryHit.category) return "category";
  return "none";
}

export function rankScore(query: string, poi: TaiwanPoiRecord) {
  const tier = matchTier(query, poi);
  let score = TIER_SCORE[tier];
  const exact = matchedExactPlace(query);
  if (exact && exact.names.some((name) => poi.nameNormalized.includes(normalizePoiKey(name)))) {
    score = Math.max(score, 110);
  }
  score += Math.round((poi.confidence ?? 0.8) * 8);
  return score;
}

export function rankPois(
  rows: TaiwanPoiRecord[],
  query: string,
  origin?: { lat: number; lng: number },
) {
  const intent = classifyPoiQuery(query);
  const nearby = Boolean(origin && prefersNearby(intent));
  return [...rows].sort((a, b) => {
    const sa = rankScore(query, a);
    const sb = rankScore(query, b);
    const delta = sb - sa;
    if (nearby && origin && Math.abs(delta) < 12) {
      const da = distanceKm(origin, { lat: a.latitude, lng: a.longitude });
      const db = distanceKm(origin, { lat: b.latitude, lng: b.longitude });
      if (da !== db) return da - db;
    }
    if (delta !== 0) return delta;
    if (origin) {
      return (
        distanceKm(origin, { lat: a.latitude, lng: a.longitude }) -
        distanceKm(origin, { lat: b.latitude, lng: b.longitude })
      );
    }
    return a.name.localeCompare(b.name, "zh-Hant");
  });
}
