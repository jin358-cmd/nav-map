import "server-only";

import { matchLandmarks } from "@/data/landmarks";
import { distanceKm } from "@/lib/geo";
import { formatTaiwanDisplayAddress } from "@/lib/geocoding/format-taiwan-display-address";
import {
  matchKindLabel,
  normalizeTaiwanAddress,
  relaxedAddressQueries,
} from "@/lib/geocoding/normalizeTaiwanAddress";
import { rankAddressResults } from "@/lib/geocoding/address-ranking";
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
import { classifyPoiQuery } from "@/lib/poi/intent";
import { searchTaiwanPoiIndex } from "@/lib/poi/server-index";
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

async function localResults(
  query: string,
  latitude?: number,
  longitude?: number,
  signal?: AbortSignal,
): Promise<GeocodeResult[]> {
  const origin =
    latitude != null && longitude != null
      ? { lat: latitude, lng: longitude }
      : undefined;
  const indexRows = await searchTaiwanPoiIndex(query, origin, signal);
  const landmarks = matchLandmarks(query, 6).map((hit) => ({
    id: hit.id,
    label: hit.name,
    formattedAddress: hit.address,
    latitude: hit.location.lat,
    longitude: hit.location.lng,
    source: "local" as const,
    confidence: 0.68,
    exactHouseNumber: false,
    matchKind: "landmark" as const,
  }));
  return mergeResults([...indexRows, ...landmarks]);
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
  query: string,
  origin?: { lat: number; lng: number },
) {
  return rankAddressResults(rows, query, origin);
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
    formattedAddress:
      item.matchKind === "landmark" ||
      item.formattedAddress.includes(matchKindLabel(item.matchKind)) ||
      item.formattedAddress.includes("推估") ||
      item.formattedAddress.includes("附近")
        ? item.formattedAddress
        : item.exactHouseNumber
          ? `${item.formattedAddress} · ${matchKindLabel(item.matchKind)}`
          : `${item.formattedAddress} · ${item.matchKind === "interpolated" ? "推估" : matchKindLabel(item.matchKind)}`,
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
    locatedCity?: string;
    locatedTown?: string;
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

  const intent = classifyPoiQuery(query);
  const addressIntent = intent === "address";
  const locals =
    addressIntent
      ? []
      : await localResults(query, options.latitude, options.longitude, options.signal);
  if (locals.length) statuses.local = "ok";

  const cached = await readAddressCache(parsed.normalizedAddress, key);
  if (cached?.length) statuses.cache = "ok";

  const rankedLocals = sortResults(
    withDistance(mergeResults([...locals, ...(cached ?? [])]), origin),
    query,
    origin,
  ).slice(0, SEARCH_RESULT_LIMIT);
  const qualityCount = rankedLocals.filter((item) => (item.confidence ?? 0) >= 0.7).length;
  const localReady =
    !addressIntent &&
    intent !== "mixed" &&
    (qualityCount >= 4 || (intent === "exact" && qualityCount >= 1));

  if (localReady) {
    return {
      query,
      normalizedQuery: parsed.normalizedAddress,
      cacheHit: Boolean(cached?.length),
      results: rankedLocals,
      providers: statuses,
    };
  }

  if (mode === "suggest" && !addressIntent && intent !== "mixed") {
    return {
      query,
      normalizedQuery: parsed.normalizedAddress,
      cacheHit: Boolean(cached?.length),
      results: rankedLocals,
      providers: statuses,
    };
  }

  const tgos = createTgosProvider(parsed);
  const nlsc = createNlscProvider(parsed);
  const osm = createOsmProvider(parsed);
  const officialIndex = createOfficialIndexProvider();
  const collected: GeocodeResult[] = [...rankedLocals];
  const deadline = Date.now() + OVERALL_TIMEOUT_MS;
  const relaxations = relaxedAddressQueries(parsed);
  const firstQuery = relaxations[0]?.query ?? parsed.searchAddress;
  const typedCounty = Boolean(parsed.parts.city);
  const remoteOptions =
    intent === "exact" || typedCounty
      ? { ...options, latitude: undefined, longitude: undefined }
      : options;
  const allowOsm = mode !== "suggest";
  let ranOsm = false;

  if (Date.now() <= deadline && !options.signal?.aborted) {
    const official = await Promise.allSettled([
      runProvider(officialIndex, firstQuery, remoteOptions, statuses),
      runProvider(tgos, firstQuery, remoteOptions, statuses),
      runProvider(nlsc, firstQuery, remoteOptions, statuses),
    ]);
    for (const outcome of official) {
      if (outcome.status === "fulfilled") collected.push(...outcome.value);
    }
    if (allowOsm) {
      const osmRows = await runProvider(osm, firstQuery, remoteOptions, statuses);
      ranOsm = true;
      collected.push(...osmRows);
    } else {
      statuses.osm = "disabled";
    }
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
        runProvider(officialIndex, step.query, remoteOptions, statuses),
        runProvider(tgos, step.query, remoteOptions, statuses),
        runProvider(nlsc, step.query, remoteOptions, statuses),
      ]);
      for (const outcome of official) {
        if (outcome.status === "fulfilled") collected.push(...outcome.value);
      }
      if (collected.some((item) => item.exactHouseNumber)) break;
    }
  }

  if (
    allowOsm &&
    !ranOsm &&
    !collected.some((item) => item.exactHouseNumber) &&
    Date.now() < deadline &&
    !options.signal?.aborted
  ) {
    const osmRows = await runProvider(osm, firstQuery, remoteOptions, statuses);
    collected.push(...osmRows);
  }

  const merged = applyLaneRoadLabels(
    sortResults(withDistance(mergeResults(collected), origin), query, origin),
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
    category: item.category,
    branchName: item.branchName ?? undefined,
    phone: item.phone,
    hours: item.hours,
    navEligibilityScore: item.navEligibilityScore,
    locationIncomplete: item.locationIncomplete,
    resultGroup: item.resultGroup,
    accuracyLabel: item.accuracyLabel,
    regionValidation: item.regionValidation,
  }));
}
