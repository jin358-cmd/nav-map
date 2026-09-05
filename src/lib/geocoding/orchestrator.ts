import "server-only";

import { matchLandmarks } from "@/data/landmarks";
import { distanceKm } from "@/lib/geo";
import { formatTaiwanDisplayAddress } from "@/lib/geocoding/format-taiwan-display-address";
import {
  matchKindLabel,
  normalizeTaiwanAddress,
  relaxedAddressQueries,
} from "@/lib/geocoding/normalizeTaiwanAddress";
import {
  readAddressCache,
  writeAddressCache,
} from "@/lib/geocoding/providers/cache";
import {
  createOfficialIndexProvider,
  officialIndexEnabled,
} from "@/lib/geocoding/providers/official-index";
import { createNlscProvider } from "@/lib/geocoding/providers/nlsc";
import { createOsmProvider } from "@/lib/geocoding/providers/osm";
import { createTgosProvider, tgosEnabled } from "@/lib/geocoding/providers/tgos";
import { matchLocalPois } from "@/lib/poi-search";
import { SEARCH_RESULT_LIMIT } from "@/lib/search-constants";
import type {
  GeocodeLookupMode,
  GeocodeProviderStatus,
  GeocodeResponse,
  GeocodeResult,
  GeocodeSource,
} from "@/lib/geocoding/types";

const PROVIDER_TIMEOUT_MS = 3000;
const OVERALL_TIMEOUT_MS = 5500;
const DEDUPE_METERS = 25;

function biasKey(latitude?: number, longitude?: number) {
  if (latitude == null || longitude == null) return "";
  return `${longitude.toFixed(2)},${latitude.toFixed(2)}`;
}

function inTaiwan(lat: number, lng: number) {
  return lng >= 118 && lng <= 123 && lat >= 20 && lat <= 27;
}

function localResults(
  query: string,
  latitude?: number,
  longitude?: number,
): GeocodeResult[] {
  const origin =
    latitude != null && longitude != null
      ? { lat: latitude, lng: longitude }
      : null;
  return [...matchLandmarks(query, 8), ...matchLocalPois(query, origin, 12)].map(
    (hit) => ({
      id: hit.id,
      label: hit.name,
      formattedAddress: hit.address,
      latitude: hit.location.lat,
      longitude: hit.location.lng,
      source: "local" as const,
      confidence: 0.7,
      exactHouseNumber: false,
      matchKind: "landmark" as const,
    }),
  );
}

async function runProvider(
  provider: { name: GeocodeSource; enabled: boolean; search: (q: string, o?: { latitude?: number; longitude?: number; timeoutMs?: number; signal?: AbortSignal }) => Promise<GeocodeResult[]> },
  query: string,
  options: { latitude?: number; longitude?: number; signal?: AbortSignal },
  statuses: Partial<Record<GeocodeSource, GeocodeProviderStatus>>,
) {
  if (!provider.enabled) {
    statuses[provider.name] = "disabled";
    return [] as GeocodeResult[];
  }
  try {
    const rows = await provider.search(query, {
      ...options,
      timeoutMs: PROVIDER_TIMEOUT_MS,
    });
    statuses[provider.name] =
      statuses[provider.name] === "ok" || rows.length
        ? "ok"
        : statuses[provider.name] ?? "empty";
    return rows;
  } catch {
    statuses[provider.name] = "error";
    return [];
  }
}

function mergeResults(rows: GeocodeResult[]) {
  const kept: GeocodeResult[] = [];
  for (const hit of rows) {
    if (!inTaiwan(hit.latitude, hit.longitude)) continue;
    const duplicate = kept.find(
      (item) =>
        distanceKm(
          { lat: item.latitude, lng: item.longitude },
          { lat: hit.latitude, lng: hit.longitude },
        ) *
          1000 <=
          DEDUPE_METERS &&
        (item.label === hit.label || item.source === hit.source || item.matchKind === hit.matchKind),
    );
    if (!duplicate) {
      kept.push(hit);
      continue;
    }
    if (hit.confidence > duplicate.confidence) {
      const index = kept.indexOf(duplicate);
      kept[index] = {
        ...hit,
        formattedAddress: `${hit.formattedAddress} · ${matchKindLabel(hit.matchKind)}`,
      };
    }
  }
  return kept;
}

function sortResults(
  rows: GeocodeResult[],
  parsedCity: string,
  parsedTown: string,
  preferLane: boolean,
  origin?: { lat: number; lng: number },
) {
  const kindRank = preferLane
    ? {
        "exact-house": 0,
        interpolated: 1,
        "lane-center": 2,
        approximate: 3,
        "road-center": 4,
        landmark: 5,
      }
    : {
        "exact-house": 0,
        interpolated: 1,
        approximate: 2,
        "lane-center": 3,
        "road-center": 4,
        landmark: 5,
      };
  const sourceRank: Record<GeocodeSource, number> = {
    cache: 0,
    index: 1,
    tgos: 2,
    nlsc: 3,
    local: 4,
    overture: 5,
    osm: 6,
    google: 7,
  };
  return [...rows].sort((a, b) => {
    if (a.exactHouseNumber !== b.exactHouseNumber) {
      return a.exactHouseNumber ? -1 : 1;
    }
    const kindDelta = kindRank[a.matchKind] - kindRank[b.matchKind];
    if (kindDelta !== 0) return kindDelta;
    const cityA = parsedCity && a.formattedAddress.includes(parsedCity.replaceAll("台", "臺"));
    const cityB = parsedCity && b.formattedAddress.includes(parsedCity.replaceAll("台", "臺"));
    if (Boolean(cityA) !== Boolean(cityB)) return cityA ? -1 : 1;
    const townA = parsedTown && a.formattedAddress.includes(parsedTown);
    const townB = parsedTown && b.formattedAddress.includes(parsedTown);
    if (Boolean(townA) !== Boolean(townB)) return townA ? -1 : 1;
    const sourceDelta = sourceRank[a.source] - sourceRank[b.source];
    if (sourceDelta !== 0) return sourceDelta;
    if (origin) {
      const distA =
        a.distanceMeters ??
        distanceKm(origin, { lat: a.latitude, lng: a.longitude }) * 1000;
      const distB =
        b.distanceMeters ??
        distanceKm(origin, { lat: b.latitude, lng: b.longitude }) * 1000;
      if (distA !== distB) return distA - distB;
    }
    return b.confidence - a.confidence;
  });
}

function withDistance(
  rows: GeocodeResult[],
  origin?: { lat: number; lng: number },
) {
  if (!origin) return rows;
  return rows.map((item) => ({
    ...item,
    distanceMeters: Math.round(
      distanceKm(origin, { lat: item.latitude, lng: item.longitude }) * 1000,
    ),
    formattedAddress: item.formattedAddress.includes(matchKindLabel(item.matchKind))
      ? item.formattedAddress
      : `${item.formattedAddress} · ${matchKindLabel(item.matchKind)}`,
  }));
}

function applyLaneRoadLabels(rows: GeocodeResult[]) {
  return rows.map((item) => {
    if (item.exactHouseNumber || item.label.includes("附近")) return item;
    const hasHouse = /\d+號/u.test(item.label);
    if (item.matchKind === "lane-center" && !hasHouse) {
      return { ...item, label: `${item.label}附近` };
    }
    if (item.matchKind === "road-center" && !hasHouse) {
      return { ...item, label: `${item.label}附近` };
    }
    return item;
  });
}

function skippedRemoteStatuses(): Partial<Record<GeocodeSource, GeocodeProviderStatus>> {
  return {
    tgos: "disabled",
    nlsc: "disabled",
    osm: "disabled",
    index: "disabled",
    overture: "disabled",
    google: "disabled_by_map_renderer_policy",
  };
}

export async function searchGeocode(
  query: string,
  options: {
    latitude?: number;
    longitude?: number;
    signal?: AbortSignal;
    mode?: GeocodeLookupMode;
  } = {},
): Promise<GeocodeResponse> {
  const mode: GeocodeLookupMode = options.mode ?? "search";
  const parsed = normalizeTaiwanAddress(query);
  const origin =
    options.latitude != null && options.longitude != null
      ? { lat: options.latitude, lng: options.longitude }
      : undefined;
  const key = biasKey(options.latitude, options.longitude);
  const statuses: Partial<Record<GeocodeSource, GeocodeProviderStatus>> =
    mode === "suggest"
      ? {
          ...skippedRemoteStatuses(),
          cache: "empty",
          local: "empty",
        }
      : {
          tgos: tgosEnabled() ? "empty" : "disabled",
          google: "disabled_by_map_renderer_policy",
          nlsc: "empty",
          osm: "empty",
          index: officialIndexEnabled() ? "empty" : "disabled",
          overture: "disabled",
          cache: "empty",
          local: "empty",
        };

  const cached = await readAddressCache(parsed.normalizedAddress, key);
  if (cached?.length) {
    statuses.cache = "ok";
    const locals = mode === "suggest" ? localResults(query, options.latitude, options.longitude) : [];
    if (locals.length) statuses.local = "ok";
    return {
      query,
      normalizedQuery: parsed.normalizedAddress,
      cacheHit: true,
      results: sortResults(
        withDistance(mode === "suggest" ? mergeResults([...cached, ...locals]) : cached, origin),
        parsed.parts.city,
        parsed.parts.town,
        parsed.hasLaneOrAlley,
        origin,
      ).slice(0, SEARCH_RESULT_LIMIT),
      providers: statuses,
    };
  }

  if (mode === "suggest") {
    const locals = localResults(query, options.latitude, options.longitude);
    if (locals.length) statuses.local = "ok";
    return {
      query,
      normalizedQuery: parsed.normalizedAddress,
      cacheHit: false,
      results: sortResults(
        withDistance(locals, origin),
        parsed.parts.city,
        parsed.parts.town,
        parsed.hasLaneOrAlley,
        origin,
      ).slice(0, SEARCH_RESULT_LIMIT),
      providers: statuses,
    };
  }

  const locals = localResults(query, options.latitude, options.longitude);
  if (locals.length) statuses.local = "ok";

  const tgos = createTgosProvider(parsed);
  const nlsc = createNlscProvider(parsed);
  const osm = createOsmProvider(parsed);
  const officialIndex = createOfficialIndexProvider();
  const collected: GeocodeResult[] = [...locals];
  const deadline = Date.now() + OVERALL_TIMEOUT_MS;
  const relaxations = relaxedAddressQueries(parsed);
  const firstQuery = relaxations[0]?.query ?? parsed.searchAddress;
  let ranOsm = false;

  if (Date.now() <= deadline && !options.signal?.aborted) {
    const [official, osmRows] = await Promise.all([
      Promise.allSettled([
        runProvider(officialIndex, firstQuery, options, statuses),
        runProvider(tgos, firstQuery, options, statuses),
        runProvider(nlsc, firstQuery, options, statuses),
      ]),
      runProvider(osm, firstQuery, options, statuses),
    ]);
    ranOsm = true;
    for (const outcome of official) {
      if (outcome.status === "fulfilled") collected.push(...outcome.value);
    }
    collected.push(...osmRows);
  }

  const strongEnough =
    collected.some((item) => item.exactHouseNumber) ||
    collected.filter(
      (item) =>
        item.matchKind === "interpolated" ||
        item.matchKind === "approximate" ||
        item.confidence >= 0.65,
    ).length >= 2;

  if (!strongEnough) {
    for (const step of relaxations.slice(1)) {
      if (Date.now() > deadline || options.signal?.aborted) break;
      const official = await Promise.allSettled([
        runProvider(officialIndex, step.query, options, statuses),
        runProvider(tgos, step.query, options, statuses),
        runProvider(nlsc, step.query, options, statuses),
      ]);
      for (const outcome of official) {
        if (outcome.status === "fulfilled") collected.push(...outcome.value);
      }
      if (collected.some((item) => item.exactHouseNumber)) break;
    }
  }

  if (
    !ranOsm &&
    !collected.some((item) => item.exactHouseNumber) &&
    Date.now() < deadline &&
    !options.signal?.aborted
  ) {
    const osmRows = await runProvider(osm, firstQuery, options, statuses);
    collected.push(...osmRows);
  }

  const merged = applyLaneRoadLabels(
    sortResults(
      withDistance(mergeResults(collected), origin),
      parsed.parts.city,
      parsed.parts.town,
      parsed.hasLaneOrAlley,
      origin,
    ),
  ).slice(0, SEARCH_RESULT_LIMIT);

  if (merged.length) {
    const cacheable = merged.filter((item) => item.source !== "google");
    if (cacheable.length) {
      void writeAddressCache(query, parsed.normalizedAddress, cacheable, key);
    }
  }

  return {
    query,
    normalizedQuery: parsed.normalizedAddress,
    cacheHit: false,
    results: merged,
    providers: statuses,
  };
}

export function toGeocodeHits(results: GeocodeResult[]) {
  return results.map((item) => ({
    id: item.id,
    name: formatTaiwanDisplayAddress(item.label),
    address: formatTaiwanDisplayAddress(item.formattedAddress),
    location: { lng: item.longitude, lat: item.latitude },
    source: item.source,
    exactHouseNumber: item.exactHouseNumber,
    matchKind: item.matchKind,
    confidence: item.confidence,
    distanceMeters: item.distanceMeters,
  }));
}
