import "server-only";

import { formatTaiwanDisplayAddress } from "@/lib/geocoding/format-taiwan-display-address";
import type { GeocodeProvider, GeocodeResult } from "@/lib/geocoding/types";

function supabaseConfig() {
  const url = (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "").trim();
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ?? "";
  if (!url || !serviceKey) return null;
  return { url: url.replace(/\/$/, ""), serviceKey };
}

export function officialIndexEnabled() {
  return Boolean(supabaseConfig());
}

export function createOfficialIndexProvider(): GeocodeProvider {
  const config = supabaseConfig();
  return {
    name: "index",
    enabled: Boolean(config),
    async search(query, options) {
      if (!config || query.trim().length < 2) return [];
      const rpc = await fetch(`${config.url}/rest/v1/rpc/search_taiwan_addresses`, {
        method: "POST",
        headers: {
          apikey: config.serviceKey,
          Authorization: `Bearer ${config.serviceKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ q: query.trim(), max_results: 12 }),
        cache: "no-store",
        signal: options?.signal,
      });
      const response = rpc.ok
        ? rpc
        : await fetch(
            `${config.url}/rest/v1/taiwan_address_index?${new URLSearchParams({
              select:
                "id,display_address,normalized_address,latitude,longitude,accuracy,source,county,district,road",
              normalized_address: `ilike.*${query.trim()}*`,
              limit: "12",
            })}`,
            {
              headers: {
                apikey: config.serviceKey,
                Authorization: `Bearer ${config.serviceKey}`,
              },
              cache: "no-store",
              signal: options?.signal,
            },
          );
      if (!response.ok) return [];
      const rows = (await response.json()) as Array<{
        id?: string;
        display_address?: string;
        normalized_address?: string;
        latitude?: number | null;
        longitude?: number | null;
        accuracy?: GeocodeResult["matchKind"];
        source?: string;
      }>;
      return rows
        .filter(
          (row) =>
            Number.isFinite(row.latitude) && Number.isFinite(row.longitude),
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
    },
  };
}
