import "server-only";

import {
  classifyMatchKind,
  type NormalizedTaiwanAddress,
} from "@/lib/geocoding/normalizeTaiwanAddress";
import type {
  GeocodeProvider,
  GeocodeResult,
  GeocodeSearchOptions,
} from "@/lib/geocoding/types";

export function googlePlacesEnabled() {
  return Boolean(process.env.GOOGLE_PLACES_API_KEY?.trim());
}

type GoogleGeocodeRow = {
  formatted_address?: string;
  place_id?: string;
  geometry?: { location?: { lat?: number; lng?: number } };
  types?: string[];
};

export function createGoogleProvider(
  parsed: NormalizedTaiwanAddress,
): GeocodeProvider {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY?.trim() ?? "";
  return {
    name: "google",
    enabled: Boolean(apiKey),
    async search(query: string, options?: GeocodeSearchOptions) {
      if (!apiKey) return [];
      const url = new URL("https://maps.googleapis.com/maps/api/geocode/json");
      url.searchParams.set("address", query);
      url.searchParams.set("language", "zh-TW");
      url.searchParams.set("region", "tw");
      url.searchParams.set("key", apiKey);
      if (options?.latitude && options.longitude) {
        url.searchParams.set(
          "bounds",
          `${options.latitude - 0.18},${options.longitude - 0.18}|${options.latitude + 0.18},${options.longitude + 0.18}`,
        );
      }

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), options?.timeoutMs ?? 3000);
      const onAbort = () => controller.abort();
      options?.signal?.addEventListener("abort", onAbort);
      try {
        const response = await fetch(url, {
          cache: "no-store",
          signal: controller.signal,
        });
        if (!response.ok) return [];
        const payload = (await response.json()) as { results?: GoogleGeocodeRow[] };
        return (payload.results ?? []).flatMap((item, index) => {
          const lat = Number(item.geometry?.location?.lat);
          const lng = Number(item.geometry?.location?.lng);
          if (!Number.isFinite(lat) || !Number.isFinite(lng)) return [];
          if (lng < 118 || lng > 123 || lat < 20 || lat > 27) return [];
          const label = item.formatted_address ?? query;
          const matchKind = classifyMatchKind(parsed, label, "approximate");
          const streetOnly = item.types?.includes("route");
          return [
            {
              id: `google-${item.place_id ?? index}`,
              label,
              formattedAddress: label,
              latitude: lat,
              longitude: lng,
              source: "google",
              confidence: matchKind === "exact-house" ? 0.9 : 0.58,
              exactHouseNumber: matchKind === "exact-house",
              matchKind: streetOnly ? "road-center" : matchKind,
            } satisfies GeocodeResult,
          ];
        });
      } catch {
        return [];
      } finally {
        clearTimeout(timer);
        options?.signal?.removeEventListener("abort", onAbort);
      }
    },
  };
}
