import { distanceKm } from "@/lib/geo";
import {
  brandsForPrefix,
  expandPoiQueries,
  matchedBrand,
  matchedCategory,
  matchedExactPlace,
  normalizePoiKey,
} from "@/lib/poi/aliases";
import { countyFromLngLat, countyMentionedInQuery } from "@/lib/poi/counties";
import { classifyPoiQuery, prefersNearby } from "@/lib/poi/intent";
import {
  isSuggestEligiblePoi,
  registryRankBoost,
} from "@/lib/poi/nav-eligibility";
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

export type PoiQueryContext = {
  query: string;
  needle: string;
  variants: string[];
  prefixBrands: ReturnType<typeof brandsForPrefix>;
  brandHit: ReturnType<typeof matchedBrand>;
  categoryHit: ReturnType<typeof matchedCategory>;
  exactPlace: ReturnType<typeof matchedExactPlace>;
  namedCity: string | null;
  intent: ReturnType<typeof classifyPoiQuery>;
};

export function poiQueryContext(query: string): PoiQueryContext {
  const needle = normalizePoiKey(query);
  return {
    query,
    needle,
    variants: expandPoiQueries(query).map(normalizePoiKey),
    prefixBrands: brandsForPrefix(query),
    brandHit: matchedBrand(query),
    categoryHit: matchedCategory(query),
    exactPlace: matchedExactPlace(query),
    namedCity: countyMentionedInQuery(query),
    intent: classifyPoiQuery(query),
  };
}

export function matchTier(query: string, poi: TaiwanPoiRecord): MatchTier {
  return matchTierWith(poiQueryContext(query), poi);
}

export function matchTierWith(ctx: PoiQueryContext, poi: TaiwanPoiRecord): MatchTier {
  const needle = ctx.needle;
  if (!needle || !poi.isActive) return "none";
  const name = poi.nameNormalized || normalizePoiKey(poi.name);
  const brand = poi.brand ? normalizePoiKey(poi.brand) : "";
  const branch = poi.branchName ? normalizePoiKey(poi.branchName) : "";
  const aliases = poi.aliases;
  const address = poi.addressNormalized || "";

  if (name === needle || brand === needle || branch === needle) {
    if (
      ctx.categoryHit &&
      ctx.needle === normalizePoiKey(ctx.categoryHit.names[0] ?? ctx.categoryHit.category)
    ) {
      return "category";
    }
    return "exact";
  }
  if (aliases.includes(needle) || ctx.variants.includes(name)) return "exact";

  if (
    name.startsWith(needle) ||
    brand.startsWith(needle) ||
    branch.startsWith(needle) ||
    address.startsWith(needle)
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
    if (ctx.prefixBrands.some((item) => item.brand === poi.brand)) return "brand";
  }

  const brandHit = ctx.brandHit;
  if (
    brandHit &&
    (poi.brand === brandHit.brand ||
      name.includes(normalizePoiKey(brandHit.brand)) ||
      aliases.some((alias) => alias.includes(normalizePoiKey(brandHit.brand))))
  ) {
    return "brand";
  }

  if (
    name.includes(needle) ||
    brand.includes(needle) ||
    address.includes(needle) ||
    aliases.some((alias) => alias.includes(needle))
  ) {
    return "fuzzy";
  }

  if (ctx.categoryHit && poi.category === ctx.categoryHit.category) return "category";
  return "none";
}

export function rankScore(
  query: string,
  poi: TaiwanPoiRecord,
  origin?: { lat: number; lng: number },
) {
  return rankScoreWith(poiQueryContext(query), poi, origin);
}

export function rankScoreWith(
  ctx: PoiQueryContext,
  poi: TaiwanPoiRecord,
  origin?: { lat: number; lng: number },
) {
  const tier = matchTierWith(ctx, poi);
  let score = TIER_SCORE[tier];
  if (
    ctx.exactPlace &&
    ctx.exactPlace.names.some((name) => poi.nameNormalized.includes(normalizePoiKey(name)))
  ) {
    score = Math.max(score, 110);
  }
  score += Math.round((poi.confidence ?? 0.8) * 8);
  score += registryRankBoost(poi);
  if (ctx.needle.length <= 2 && poi.brand) {
    if (ctx.prefixBrands.some((item) => item.brand === poi.brand)) score += 28;
  }
  if (ctx.needle.length <= 2 && ctx.categoryHit && poi.category === ctx.categoryHit.category) {
    score += 28;
  }
  if (ctx.namedCity && normalizePoiKey(poi.city ?? "") === normalizePoiKey(ctx.namedCity)) {
    score += 14;
  } else if (!ctx.namedCity && origin) {
    const here = countyFromLngLat(origin.lat, origin.lng);
    if (here && normalizePoiKey(poi.city ?? "") === normalizePoiKey(here)) {
      score += 6;
    }
  }
  if (origin && prefersNearby(ctx.intent)) {
    const km = distanceKm(origin, { lat: poi.latitude, lng: poi.longitude });
    score -= Math.min(48, Math.round(km * 6));
  }
  return score;
}

export function rankPois(
  rows: TaiwanPoiRecord[],
  query: string,
  origin?: { lat: number; lng: number },
) {
  const ctx = poiQueryContext(query);
  const nearby = Boolean(origin && prefersNearby(ctx.intent));
  const scored = rows.filter(isSuggestEligiblePoi).map((poi) => ({
    poi,
    score: rankScoreWith(ctx, poi, origin),
    dist: origin
      ? distanceKm(origin, { lat: poi.latitude, lng: poi.longitude })
      : 0,
  }));
  scored.sort((a, b) => {
    const delta = b.score - a.score;
    if (nearby && origin && Math.abs(delta) < 12) {
      if (a.dist !== b.dist) return a.dist - b.dist;
    }
    if (delta !== 0) return delta;
    if (origin && a.dist !== b.dist) return a.dist - b.dist;
    return a.poi.name.localeCompare(b.poi.name, "zh-Hant");
  });
  return scored.map((row) => row.poi);
}
