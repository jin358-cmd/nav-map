import { formatTaiwanDisplayAddress } from "@/lib/geocoding/format-taiwan-display-address";
import { distanceKm } from "@/lib/geo";
import { expandPoiQueries, normalizePoiKey } from "@/lib/poi/aliases";
import { classifyPoiQuery, isDoorplateQuery, prefersNearby } from "@/lib/poi/intent";
import { SEARCH_RESULT_LIMIT } from "@/lib/search-constants";
import type { GeocodeHit, LngLat } from "@/types/domain";

export { isDoorplateQuery } from "@/lib/poi/intent";
export { expandPoiQueries as expandKeywordQueries, normalizePoiKey as normalizeSearchKey } from "@/lib/poi/aliases";

export function scoreNameMatch(query: string, name: string) {
  const variants = expandPoiQueries(query).map(normalizePoiKey);
  const hay = normalizePoiKey(name);
  if (!hay) return 0;
  let best = 0;
  for (const needle of variants) {
    if (!needle) continue;
    if (hay === needle) best = Math.max(best, 8);
    else if (hay.startsWith(needle) || needle.startsWith(hay)) best = Math.max(best, 6);
    else if (hay.includes(needle)) best = Math.max(best, 5);
  }
  if (isDoorplateQuery(query)) {
    const qDigits = query.replace(/\D/g, "");
    const nDigits = name.replace(/\D/g, "");
    if (qDigits && nDigits.endsWith(qDigits)) best = Math.max(best, 12);
    if (hay.includes(normalizePoiKey(query))) best = Math.max(best, 10);
  }
  return best;
}

export function mergeSearchHits(rows: GeocodeHit[], limit = SEARCH_RESULT_LIMIT) {
  const seen = new Set<string>();
  const out: GeocodeHit[] = [];
  for (const hit of rows) {
    const key = `${normalizePoiKey(hit.name)}|${hit.location.lng.toFixed(4)}|${hit.location.lat.toFixed(4)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(hit);
  }
  return out.slice(0, limit);
}

export function matchSavedPlaces(query: string, places: GeocodeHit[]) {
  const variants = expandPoiQueries(query).map(normalizePoiKey);
  return places.filter((hit) => {
    const hay = normalizePoiKey(`${hit.name} ${hit.address}`);
    return variants.some(
      (needle) => needle.length >= 1 && (hay.includes(needle) || needle.includes(hay)),
    );
  });
}

export function instantKeywordHits(
  query: string,
  origin: LngLat | null,
  extras: GeocodeHit[] = [],
  limit = 8,
): GeocodeHit[] {
  return rankSearchHits(mergeSearchHits(matchSavedPlaces(query, extras), 24), query, origin).slice(
    0,
    limit,
  );
}

export function rankSearchHits(
  hits: GeocodeHit[],
  query: string,
  origin: LngLat | null,
): GeocodeHit[] {
  const intent = classifyPoiQuery(query);
  const nearby = Boolean(origin && prefersNearby(intent));
  return [...hits].sort((a, b) => {
    const nameDelta = scoreNameMatch(query, b.name) - scoreNameMatch(query, a.name);
    if (nearby && origin) {
      if (nameDelta >= 4) return nameDelta;
      const da = a.distanceMeters ?? distanceKm(origin, a.location) * 1000;
      const db = b.distanceMeters ?? distanceKm(origin, b.location) * 1000;
      if (da !== db) return da - db;
    }
    if (nameDelta !== 0) return nameDelta;
    if (!origin) return 0;
    return (
      (a.distanceMeters ?? distanceKm(origin, a.location) * 1000) -
      (b.distanceMeters ?? distanceKm(origin, b.location) * 1000)
    );
  });
}

export function destinationToHit(destination: {
  label: string;
  address: string;
  location: LngLat;
}): GeocodeHit {
  return {
    id: `place-${destination.location.lng.toFixed(5)}-${destination.location.lat.toFixed(5)}`,
    name: formatTaiwanDisplayAddress(destination.label),
    address: formatTaiwanDisplayAddress(destination.address),
    location: destination.location,
  };
}

export function nearbyCategoryHint(query: string) {
  const intent = classifyPoiQuery(query);
  if (intent === "brand") return "便利商店";
  if (intent === "category") return query.trim();
  return "便利商店";
}
