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
import { searchNlscMapHits } from "@/services/official-address";

export function nlscEnabled() {
  return true;
}

export function createNlscProvider(
  parsed: NormalizedTaiwanAddress,
): GeocodeProvider {
  return {
    name: "nlsc",
    enabled: nlscEnabled(),
    async search(query: string, options?: GeocodeSearchOptions) {
      try {
        const rows = await searchNlscMapHits(
          query,
          options?.latitude && options.longitude
            ? { lat: options.latitude, lng: options.longitude }
            : undefined,
          options?.timeoutMs ?? 3000,
        );
        return rows.map((item, index) => {
          const fallback =
            item.kind === "ADDRESS"
              ? "exact-house"
              : item.kind === "CROSSROAD"
                ? "lane-center"
                : item.kind === "LANDGOAL"
                  ? "landmark"
                  : "approximate";
          const matchKind = classifyMatchKind(parsed, item.fullAddress, fallback);
          return {
            id: `nlsc-${item.kind}-${index}-${item.location.lng.toFixed(5)}-${item.location.lat.toFixed(5)}`,
            label: item.fullAddress,
            formattedAddress: item.fullAddress,
            latitude: item.location.lat,
            longitude: item.location.lng,
            source: "nlsc",
            confidence:
              matchKind === "exact-house"
                ? 0.94
                : item.kind === "ADDRESS"
                  ? 0.88
                  : 0.64,
            exactHouseNumber: matchKind === "exact-house",
            matchKind,
          } satisfies GeocodeResult;
        });
      } catch {
        return [];
      }
    },
  };
}
