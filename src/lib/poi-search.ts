import { formatTaiwanDisplayAddress } from "@/lib/geocoding/format-taiwan-display-address";
import { comparableTaiwanText } from "@/lib/geocoding/normalizeTaiwanAddress";
import { distanceKm } from "@/lib/geo";
import { expandPoiQueries, normalizePoiKey } from "@/lib/poi/aliases";
import { classifyPoiQuery, isDoorplateQuery, prefersNearby } from "@/lib/poi/intent";
import { SEARCH_RESULT_LIMIT } from "@/lib/search-constants";
import type { GeocodeHit, LngLat } from "@/types/domain";

export type SearchRegion = {
  city: string;
  town: string;
};

function regionHaystack(hit: Pick<GeocodeHit, "name" | "address">) {
  return comparableTaiwanText(`${hit.name} ${hit.address}`);
}

function queryNamesOtherCity(query: string, locatedCity: string) {
  if (!locatedCity) return false;
  const hay = comparableTaiwanText(query);
  const located = comparableTaiwanText(locatedCity);
  if (!located || hay.includes(located)) return false;
  return /[縣市]/u.test(query);
}

export function scoreLocatedRegion(
  hit: Pick<GeocodeHit, "name" | "address">,
  region: SearchRegion | null | undefined,
) {
  if (!region?.city && !region?.town) return 0;
  const hay = regionHaystack(hit);
  const city = comparableTaiwanText(region.city);
  const town = comparableTaiwanText(region.town);
  if (town && hay.includes(town)) return 4;
  if (city && hay.includes(city)) return 2;
  return 0;
}

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
  region?: SearchRegion | null,
): GeocodeHit[] {
  return rankSearchHits(
    mergeSearchHits(matchSavedPlaces(query, extras), 24),
    query,
    origin,
    region,
  ).slice(0, limit);
}

export function rankSearchHits(
  hits: GeocodeHit[],
  query: string,
  origin: LngLat | null,
  region?: SearchRegion | null,
): GeocodeHit[] {
  const intent = classifyPoiQuery(query);
  const nearby = Boolean(origin && prefersNearby(intent));
  const located =
    region && !queryNamesOtherCity(query, region.city) ? region : null;
  return [...hits].sort((a, b) => {
    const regionDelta = scoreLocatedRegion(b, located) - scoreLocatedRegion(a, located);
    if (regionDelta !== 0) return regionDelta;
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
