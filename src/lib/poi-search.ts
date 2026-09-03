import { matchLandmarks } from "@/data/landmarks";
import { BRAND_ALIASES, TAINAN_POIS } from "@/data/tainan-pois";
import { distanceKm } from "@/lib/geo";
import { SEARCH_RADIUS_KM, SEARCH_RESULT_LIMIT } from "@/lib/search-constants";
import type { GeocodeHit, LngLat } from "@/types/domain";

export function normalizeSearchKey(value: string) {
  return value
    .toLowerCase()
    .replaceAll("臺", "台")
    .replace(/[\s\-_.＋+]/g, "");
}

export function isDoorplateQuery(query: string) {
  return /[路街巷弄段號大道]/.test(query) && /\d/.test(query);
}

export function expandKeywordQueries(query: string): string[] {
  const compact = query.trim();
  const needle = normalizeSearchKey(compact);
  const names = new Set<string>([compact]);
  if (needle.length < 1) return [compact];

  for (const brand of BRAND_ALIASES) {
    const hit = brand.keys.some((key) => {
      const token = normalizeSearchKey(key);
      return needle === token || needle.includes(token) || token.includes(needle);
    });
    if (!hit) continue;
    for (const name of brand.names) names.add(name);
  }
  return [...names];
}

export function filterWithinSearchRadius(
  hits: GeocodeHit[],
  origin: LngLat,
  radiusKm = SEARCH_RADIUS_KM,
): GeocodeHit[] {
  return hits.filter(
    (hit) => distanceKm(origin, hit.location) <= radiusKm,
  );
}

export function scoreNameMatch(query: string, name: string) {
  const variants = expandKeywordQueries(query).map(normalizeSearchKey);
  const hay = normalizeSearchKey(name);
  if (!hay) return 0;
  let best = 0;
  for (const needle of variants) {
    if (!needle) continue;
    if (hay === needle) best = Math.max(best, 8);
    else if (hay.startsWith(needle) || needle.startsWith(hay)) best = Math.max(best, 6);
    else if (hay.includes(needle)) best = Math.max(best, 5);
  }
  const brandNames = expandKeywordQueries(query)
    .slice(1)
    .map(normalizeSearchKey);
  if (brandNames.some((brand) => brand.length >= 2 && hay.includes(brand))) {
    best = Math.max(best, 10);
  }
  if (isDoorplateQuery(query)) {
    const qDigits = query.replace(/\D/g, "");
    const nDigits = name.replace(/\D/g, "");
    if (qDigits && nDigits.endsWith(qDigits)) best = Math.max(best, 12);
    if (hay.includes(normalizeSearchKey(query))) best = Math.max(best, 10);
  } else if (/^\d+$/.test(hay) || /\d+號/.test(name)) {
    best -= 6;
  }
  return best;
}

export function mergeSearchHits(rows: GeocodeHit[], limit = SEARCH_RESULT_LIMIT) {
  const seen = new Set<string>();
  const out: GeocodeHit[] = [];
  for (const hit of rows) {
    const key = `${hit.name}|${hit.location.lng.toFixed(5)}|${hit.location.lat.toFixed(5)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(hit);
  }
  return out.slice(0, limit);
}

export function matchSavedPlaces(query: string, places: GeocodeHit[]) {
  const variants = expandKeywordQueries(query).map(normalizeSearchKey);
  return places.filter((hit) => {
    const hay = normalizeSearchKey(`${hit.name} ${hit.address}`);
    return variants.some(
      (needle) => needle.length >= 1 && (hay.includes(needle) || needle.includes(hay)),
    );
  });
}

export function instantKeywordHits(
  query: string,
  origin: LngLat,
  extras: GeocodeHit[] = [],
  limit = 8,
): GeocodeHit[] {
  return rankSearchHits(
    filterWithinSearchRadius(
      mergeSearchHits(
        [
          ...matchLandmarks(query, 8),
          ...matchLocalPois(query, origin, 12),
          ...matchSavedPlaces(query, extras),
        ],
        24,
      ),
      origin,
    ),
    query,
    origin,
  ).slice(0, limit);
}

export function rankSearchHits(
  hits: GeocodeHit[],
  query: string,
  origin: LngLat,
): GeocodeHit[] {
  return [...hits].sort((a, b) => {
    const nameDelta =
      scoreNameMatch(query, b.name) - scoreNameMatch(query, a.name);
    if (nameDelta !== 0) return nameDelta;
    return distanceKm(origin, a.location) - distanceKm(origin, b.location);
  });
}

export function matchLocalPois(
  query: string,
  origin: LngLat,
  limit = SEARCH_RESULT_LIMIT,
): GeocodeHit[] {
  const variants = expandKeywordQueries(query).map(normalizeSearchKey);
  const rows = TAINAN_POIS.filter((poi) => {
    if (distanceKm(origin, poi.location) > SEARCH_RADIUS_KM) return false;
    const hay = normalizeSearchKey(
      `${poi.name} ${poi.address} ${poi.aliases.join(" ")}`,
    );
    return variants.some(
      (needle) => needle.length >= 1 && (hay.includes(needle) || needle.includes(normalizeSearchKey(poi.name))),
    );
  }).map((poi) => ({
    id: poi.id,
    name: poi.name,
    address: poi.address,
    location: poi.location,
  }));

  return rankSearchHits(rows, query, origin).slice(0, limit);
}

export function destinationToHit(destination: {
  label: string;
  address: string;
  location: LngLat;
}): GeocodeHit {
  return {
    id: `place-${destination.location.lng.toFixed(5)}-${destination.location.lat.toFixed(5)}`,
    name: destination.label,
    address: destination.address,
    location: destination.location,
  };
}
