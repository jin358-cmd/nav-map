import "server-only";

import { classifyMatchKind } from "@/lib/geocoding/normalizeTaiwanAddress";
import type {
  GeocodeProvider,
  GeocodeResult,
  GeocodeSearchOptions,
} from "@/lib/geocoding/types";
import { searchHouseholdAddresses } from "@/services/official-address";
import type { NormalizedTaiwanAddress } from "@/lib/geocoding/normalizeTaiwanAddress";

export function tgosEnabled() {
  const url = process.env.TGOS_API_URL?.trim();
  return Boolean(
    (process.env.TGOS_APP_ID?.trim() && process.env.TGOS_API_KEY?.trim()) ||
      (url && process.env.TGOS_API_KEY?.trim()),
  );
}

export function createTgosProvider(
  parsed: NormalizedTaiwanAddress,
): GeocodeProvider {
  return {
    name: "tgos",
    enabled: tgosEnabled(),
    async search(query: string, options?: GeocodeSearchOptions) {
      void options;
      if (!tgosEnabled()) return [];
      try {
        const rows = await searchHouseholdAddresses(query);
        return rows.map((item, index) => {
          const matchKind = classifyMatchKind(
            parsed,
            item.fullAddress,
            "approximate",
            item.matchType,
          );
          return {
            id: `tgos-${index}-${item.location.lng.toFixed(5)}-${item.location.lat.toFixed(5)}`,
            label: item.fullAddress,
            formattedAddress: item.fullAddress,
            latitude: item.location.lat,
            longitude: item.location.lng,
            source: "tgos",
            confidence:
              matchKind === "exact-house"
                ? 0.96
                : matchKind === "interpolated"
                  ? 0.8
                  : 0.72,
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
