import "server-only";

import type { GeocodeProvider, GeocodeResult } from "@/lib/geocoding/types";

function supabaseConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ?? "";
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
      const params = new URLSearchParams({
        select:
          "id,display_address,normalized_address,latitude,longitude,accuracy,source,county,district,road",
        normalized_address: `ilike.*${query.trim()}*`,
        limit: "12",
      });
      const response = await fetch(
        `${config.url}/rest/v1/taiwan_address_index?${params}`,
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
          label: row.display_address || row.normalized_address || query,
          formattedAddress: row.display_address || row.normalized_address || query,
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
