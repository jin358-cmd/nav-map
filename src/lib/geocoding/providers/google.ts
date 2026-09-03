import "server-only";

import type {
  GeocodeProvider,
  GeocodeProviderStatus,
} from "@/lib/geocoding/types";
import type { NormalizedTaiwanAddress } from "@/lib/geocoding/normalizeTaiwanAddress";

/** MapLibre 底圖模式下永不啟用 Google Geocoding／Places，即使金鑰存在。 */
export const GOOGLE_GEOCODING_POLICY_STATUS: GeocodeProviderStatus =
  "disabled_by_map_renderer_policy";

export function googlePlacesEnabled() {
  return false;
}

export function createGoogleProvider(
  parsed: NormalizedTaiwanAddress,
): GeocodeProvider {
  void parsed;
  return {
    name: "google",
    enabled: false,
    async search() {
      return [];
    },
  };
}
