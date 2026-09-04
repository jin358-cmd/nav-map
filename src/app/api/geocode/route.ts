import { searchGeocode, toGeocodeHits } from "@/lib/geocoding/orchestrator";
import { normalizeTaiwanAddress } from "@/lib/geocoding/normalizeTaiwanAddress";
import { rememberAddressCacheHit } from "@/lib/geocoding/providers/cache";
import type { GeocodeLookupMode } from "@/lib/geocoding/types";

export const dynamic = "force-dynamic";

function lookupMode(value: string | null): GeocodeLookupMode {
  return value === "suggest" ? "suggest" : "search";
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const query = url.searchParams.get("q")?.trim() ?? "";
  const mode = lookupMode(url.searchParams.get("mode"));
  const biasLng = Number(url.searchParams.get("lng"));
  const biasLat = Number(url.searchParams.get("lat"));
  const latitude = Number.isFinite(biasLat) ? biasLat : undefined;
  const longitude = Number.isFinite(biasLng) ? biasLng : undefined;

  if (query.length < 2) {
    const parsed = normalizeTaiwanAddress(query);
    return Response.json({
      query,
      normalizedQuery: parsed.normalizedAddress,
      cacheHit: false,
      results: [],
      providers:
        mode === "suggest"
          ? { cache: "empty", local: "empty", tgos: "disabled", nlsc: "disabled", osm: "disabled", google: "disabled" }
          : undefined,
    });
  }

  try {
    const payload = await searchGeocode(query, {
      latitude,
      longitude,
      signal: request.signal,
      mode,
    });
    const hits = toGeocodeHits(payload.results);
    return Response.json({
      ...payload,
      results: payload.results.map((item, index) => ({
        ...item,
        name: hits[index]?.name,
        address: hits[index]?.address,
        location: hits[index]?.location,
      })),
    });
  } catch {
    return Response.json({
      query,
      normalizedQuery: normalizeTaiwanAddress(query).normalizedAddress,
      cacheHit: false,
      results: [],
    });
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      query?: string;
      normalizedQuery?: string;
      lng?: number;
      lat?: number;
    };
    const normalized =
      body.normalizedQuery?.trim() ||
      normalizeTaiwanAddress(body.query ?? "").normalizedAddress;
    if (!normalized) return Response.json({ ok: false }, { status: 400 });
    const biasKey =
      Number.isFinite(body.lng) && Number.isFinite(body.lat)
        ? `${Number(body.lng).toFixed(2)},${Number(body.lat).toFixed(2)}`
        : "";
    await rememberAddressCacheHit(normalized, biasKey);
    return Response.json({ ok: true });
  } catch {
    return Response.json({ ok: true });
  }
}
