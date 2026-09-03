import "server-only";

import { SEARCH_RADIUS_KM } from "@/lib/search-constants";
import {
  classifyMatchKind,
  type NormalizedTaiwanAddress,
} from "@/lib/geocoding/normalizeTaiwanAddress";
import type {
  GeocodeProvider,
  GeocodeResult,
  GeocodeSearchOptions,
} from "@/lib/geocoding/types";

const NOMINATIM = "https://nominatim.openstreetmap.org/search";
const PHOTON = "https://photon.komoot.io/api/";
const USER_AGENT = "NavPilot/0.1 (https://github.com/jin358-cmd/nav-map)";

type NominatimRow = {
  place_id: number;
  name?: string;
  display_name: string;
  lat: string;
  lon: string;
};

type PhotonFeature = {
  geometry?: { coordinates?: number[] };
  properties?: { osm_id?: number; name?: string; street?: string };
};

async function fetchJson<T>(
  url: URL,
  timeoutMs: number,
  signal?: AbortSignal,
): Promise<T | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const onAbort = () => controller.abort();
  signal?.addEventListener("abort", onAbort);
  try {
    const response = await fetch(url, {
      headers: {
        Accept: "application/json",
        "Accept-Language": "zh-TW",
        "User-Agent": USER_AGENT,
      },
      cache: "no-store",
      signal: controller.signal,
    });
    if (!response.ok) return null;
    return (await response.json()) as T;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", onAbort);
  }
}

export function createOsmProvider(
  parsed: NormalizedTaiwanAddress,
): GeocodeProvider {
  return {
    name: "osm",
    enabled: true,
    async search(query: string, options?: GeocodeSearchOptions) {
      const timeoutMs = options?.timeoutMs ?? 3000;
      const nominatim = new URL(NOMINATIM);
      nominatim.searchParams.set("format", "jsonv2");
      nominatim.searchParams.set("countrycodes", "tw");
      nominatim.searchParams.set("limit", "8");
      nominatim.searchParams.set("q", query);
      nominatim.searchParams.set("accept-language", "zh-TW");
      if (options?.latitude && options.longitude) {
        const padLng = SEARCH_RADIUS_KM / 101;
        const padLat = SEARCH_RADIUS_KM / 111;
        nominatim.searchParams.set(
          "viewbox",
          `${options.longitude - padLng},${options.latitude + padLat},${options.longitude + padLng},${options.latitude - padLat}`,
        );
        nominatim.searchParams.set("bounded", "0");
      }

      const photon = new URL(PHOTON);
      photon.searchParams.set("q", query);
      photon.searchParams.set("limit", "8");
      photon.searchParams.set("lang", "zh");
      if (options?.latitude && options.longitude) {
        photon.searchParams.set("lat", String(options.latitude));
        photon.searchParams.set("lon", String(options.longitude));
      }

      const [nominatimRows, photonPayload] = await Promise.all([
        fetchJson<NominatimRow[]>(nominatim, timeoutMs, options?.signal),
        fetchJson<{ features?: PhotonFeature[] }>(photon, timeoutMs, options?.signal),
      ]);

      const results: GeocodeResult[] = [];
      for (const item of nominatimRows ?? []) {
        const lat = Number(item.lat);
        const lng = Number(item.lon);
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
        const label = item.name || item.display_name.split(",")[0] || query;
        const matchKind = classifyMatchKind(parsed, item.display_name, "approximate");
        const osmKind =
          matchKind === "exact-house" ? "interpolated" : matchKind;
        results.push({
          id: `osm-${item.place_id}`,
          label,
          formattedAddress: item.display_name,
          latitude: lat,
          longitude: lng,
          source: "osm",
          confidence: osmKind === "road-center" ? 0.55 : 0.48,
          exactHouseNumber: false,
          matchKind: osmKind,
        });
      }

      for (const [index, feature] of (photonPayload?.features ?? []).entries()) {
        const lng = Number(feature.geometry?.coordinates?.[0]);
        const lat = Number(feature.geometry?.coordinates?.[1]);
        if (!Number.isFinite(lng) || !Number.isFinite(lat)) continue;
        const label =
          feature.properties?.name || feature.properties?.street || query;
        const matchKind = classifyMatchKind(parsed, label, "approximate");
        results.push({
          id: `photon-${feature.properties?.osm_id ?? index}`,
          label,
          formattedAddress: label,
          latitude: lat,
          longitude: lng,
          source: "osm",
          confidence: 0.46,
          exactHouseNumber: false,
          matchKind: matchKind === "exact-house" ? "interpolated" : matchKind,
        });
      }
      return results;
    },
  };
}
