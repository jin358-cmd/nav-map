import { searchGeocode, toGeocodeHits } from "@/lib/geocoding/orchestrator";
import { normalizeTaiwanAddress } from "@/lib/geocoding/normalizeTaiwanAddress";
import { classifyPoiQuery } from "@/lib/poi/intent";
import { poiIndexStats, searchTaiwanPoiIndexTimed } from "@/lib/poi/server-index";
import {
  isHotSuggestQuery,
  readSuggestCache,
  suggestCacheKey,
  writeSuggestCache,
} from "@/lib/poi/suggest-cache";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const query = url.searchParams.get("q")?.trim() ?? "";
  const biasLng = Number(url.searchParams.get("lng"));
  const biasLat = Number(url.searchParams.get("lat"));
  const latitude = Number.isFinite(biasLat) ? biasLat : undefined;
  const longitude = Number.isFinite(biasLng) ? biasLng : undefined;
  const origin =
    latitude != null && longitude != null ? { lat: latitude, lng: longitude } : undefined;
  const parsed = normalizeTaiwanAddress(query);
  const intent = classifyPoiQuery(query);
  const addressIntent = intent === "address" || parsed.hasHouseNumber;

  if (query.length < 1) {
    return Response.json({
      query,
      stage: "local",
      fallbackPending: false,
      cacheHit: false,
      results: [],
      intent,
      timings: { prefixMs: 0, localMs: 0, remoteMs: 0, totalMs: 0 },
      index: poiIndexStats(),
    });
  }

  const wantFallback = url.searchParams.get("fallback") === "1";
  const cacheKey = suggestCacheKey(query, origin);
  if (!addressIntent && isHotSuggestQuery(query)) {
    const cached = readSuggestCache(cacheKey);
    if (cached?.length) {
      return Response.json({
        query,
        normalizedQuery: parsed.normalizedAddress,
        stage: "local",
        fallbackPending: false,
        cacheHit: true,
        intent,
        results: toGeocodeHits(cached).map((hit, index) => ({
          ...cached[index],
          name: hit.name,
          address: hit.address,
          location: hit.location,
        })),
        timings: { prefixMs: 0, localMs: 0, remoteMs: 0, totalMs: 0 },
        index: poiIndexStats(),
      });
    }
  }

  const started = performance.now();
  const localTask = addressIntent
    ? Promise.resolve({
        results: [],
        timings: { prefixMs: 0, aliasMs: 0, fuzzyMs: 0, localMs: 0, remoteMs: 0, totalMs: 0 },
        localCount: 0,
      })
    : searchTaiwanPoiIndexTimed(query, origin, request.signal, { remote: false });
  const addressTask =
    addressIntent || intent === "mixed"
      ? searchGeocode(query, {
          latitude,
          longitude,
          signal: request.signal,
          mode: "suggest",
          locatedCity: url.searchParams.get("city")?.trim() || undefined,
          locatedTown: url.searchParams.get("town")?.trim() || undefined,
        })
      : Promise.resolve(null);

  const [local, address] = await Promise.all([localTask, addressTask]);

  if (addressIntent || intent === "mixed") {
    const addressRows = address?.results ?? [];
    const merged = [...addressRows, ...local.results];
    const hits = toGeocodeHits(merged);
    return Response.json({
      query,
      normalizedQuery: parsed.normalizedAddress,
      stage: addressRows.length ? "address" : local.results.length ? "local" : "empty",
      fallbackPending: false,
      cacheHit: Boolean(address?.cacheHit),
      intent,
      results: merged.map((item, index) => ({
        ...item,
        name: hits[index]?.name,
        address: hits[index]?.address,
        location: hits[index]?.location,
        resultGroup: hits[index]?.resultGroup ?? item.resultGroup,
        accuracyLabel: hits[index]?.accuracyLabel ?? item.accuracyLabel,
      })),
      timings: {
        ...local.timings,
        totalMs: Number((performance.now() - started).toFixed(2)),
      },
      providers: address?.providers,
      index: poiIndexStats(),
    });
  }

  if (local.results.length || !wantFallback) {
    if (local.results.length && isHotSuggestQuery(query)) {
      writeSuggestCache(cacheKey, local.results);
    }
    const hits = toGeocodeHits(local.results);
    return Response.json({
      query,
      normalizedQuery: parsed.normalizedAddress,
      stage: "local",
      fallbackPending: local.results.length === 0 && query.length >= 2,
      cacheHit: false,
      intent,
      results: local.results.map((item, index) => ({
        ...item,
        name: hits[index]?.name,
        address: hits[index]?.address,
        location: hits[index]?.location,
      })),
      timings: local.timings,
      index: poiIndexStats(),
    });
  }

  const remote = await searchGeocode(query, {
    latitude,
    longitude,
    signal: request.signal,
    mode: "search",
    locatedCity: url.searchParams.get("city")?.trim() || undefined,
    locatedTown: url.searchParams.get("town")?.trim() || undefined,
  });
  const hits = toGeocodeHits(remote.results);
  return Response.json({
    query,
    normalizedQuery: parsed.normalizedAddress,
    stage: remote.results.length ? "fallback" : "empty",
    fallbackPending: false,
    cacheHit: remote.cacheHit,
    intent,
    results: remote.results.map((item, index) => ({
      ...item,
      name: hits[index]?.name,
      address: hits[index]?.address,
      location: hits[index]?.location,
    })),
    timings: {
      ...local.timings,
      fallbackMs: Number((performance.now() - started).toFixed(2)),
      totalMs: Number((performance.now() - started).toFixed(2)),
    },
    providers: remote.providers,
    index: poiIndexStats(),
  });
}
