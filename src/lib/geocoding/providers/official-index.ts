import "server-only";

import { formatTaiwanDisplayAddress } from "@/lib/geocoding/format-taiwan-display-address";
import { addressFallbackSearchParams } from "@/lib/geocoding/address-cloud-query";
import {
  localAddressIndexEnabled,
  searchLocalAddressIndex,
} from "@/lib/geocoding/local-address-index";
import { getSupabaseAnonConfig } from "@/lib/supabase/anon";
import type { GeocodeProvider, GeocodeResult } from "@/lib/geocoding/types";

export { addressFallbackSearchParams } from "@/lib/geocoding/address-cloud-query";

export function officialIndexEnabled() {
  return Boolean(getSupabaseAnonConfig() || localAddressIndexEnabled());
}

function mapRows(
  rows: Array<{
    id?: string;
    display_address?: string;
    normalized_address?: string;
    latitude?: number | null;
    longitude?: number | null;
    accuracy?: GeocodeResult["matchKind"];
    source?: string;
    county?: string;
  }>,
  query: string,
): GeocodeResult[] {
  const south = new Set([
    "雲林縣",
    "嘉義市",
    "嘉義縣",
    "臺南市",
    "高雄市",
    "屏東縣",
  ]);
  return rows
    .filter(
      (row) =>
        Number.isFinite(row.latitude) &&
        Number.isFinite(row.longitude) &&
        (!row.county || south.has(row.county)),
    )
    .map((row) => ({
      id: `index-${row.id ?? row.normalized_address}`,
      label: formatTaiwanDisplayAddress(
        row.display_address || row.normalized_address || query,
      ),
      formattedAddress: formatTaiwanDisplayAddress(
        row.display_address || row.normalized_address || query,
      ),
      latitude: Number(row.latitude),
      longitude: Number(row.longitude),
      source: "index" as const,
      confidence: row.accuracy === "exact-house" ? 0.86 : 0.62,
      exactHouseNumber: row.accuracy === "exact-house",
      matchKind: row.accuracy ?? "approximate",
    }));
}

export function createOfficialIndexProvider(): GeocodeProvider {
  const localEnabled = localAddressIndexEnabled();
  return {
    name: "index",
    enabled: officialIndexEnabled(),
    async search(query, options) {
      if (query.trim().length < 2) return [];
      const config = getSupabaseAnonConfig();
      if (!config) {
        return localEnabled ? searchLocalAddressIndex(query, 12) : [];
      }
      const headers = {
        apikey: config.anonKey,
        Authorization: `Bearer ${config.anonKey}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      };
      try {
        const rpc = await fetch(`${config.url}/rest/v1/rpc/search_taiwan_addresses`, {
          method: "POST",
          headers,
          body: JSON.stringify({ q: query.trim(), max_results: 12 }),
          cache: "no-store",
          signal: options?.signal,
        });
        const response = rpc.ok
          ? rpc
          : await fetch(
              `${config.url}/rest/v1/taiwan_address_index?${addressFallbackSearchParams(query).toString()}`,
              {
                headers,
                cache: "no-store",
                signal: options?.signal,
              },
            );
        if (!response.ok) {
          return localEnabled ? searchLocalAddressIndex(query, 12) : [];
        }
        const rows = (await response.json()) as Parameters<typeof mapRows>[0];
        const mapped = Array.isArray(rows) ? mapRows(rows, query) : [];
        if (mapped.length) return mapped;
        return localEnabled ? searchLocalAddressIndex(query, 12) : [];
      } catch {
        return localEnabled ? searchLocalAddressIndex(query, 12) : [];
      }
    },
  };
}
