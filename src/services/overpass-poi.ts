import "server-only";

import { SEARCH_RADIUS_KM } from "@/lib/search-constants";
import type { GeocodeHit, LngLat } from "@/types/domain";

const OVERPASS = "https://overpass-api.de/api/interpreter";
const USER_AGENT = "NavPilot/0.1 (https://github.com/jin358-cmd/nav-map)";

type OverpassElement = {
  id?: number;
  lat?: number;
  lon?: number;
  center?: { lat?: number; lon?: number };
  tags?: { name?: string; brand?: string; "addr:full"?: string; "addr:street"?: string };
};

function escapeRegex(value: string) {
  return value.replace(/[\\^$.*+?()[\]{}|]/g, "\\$&");
}

export async function searchOverpassPois(
  query: string,
  bias: LngLat,
): Promise<GeocodeHit[]> {
  const needle = query.trim();
  if (needle.length < 2) return [];
  const pattern = escapeRegex(needle);
  const body = `[out:json][timeout:6];
(
  nwr["name"~"${pattern}",i](around:${Math.round(SEARCH_RADIUS_KM * 1000)},${bias.lat},${bias.lng});
  nwr["brand"~"${pattern}",i](around:${Math.round(SEARCH_RADIUS_KM * 1000)},${bias.lat},${bias.lng});
  nwr["operator"~"${pattern}",i](around:${Math.round(SEARCH_RADIUS_KM * 1000)},${bias.lat},${bias.lng});
);
out center 18;`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 6_500);
  try {
    const response = await fetch(OVERPASS, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
        "User-Agent": USER_AGENT,
      },
      body: new URLSearchParams({ data: body }),
      cache: "no-store",
      signal: controller.signal,
    });
    if (!response.ok) return [];
    const payload = (await response.json()) as { elements?: OverpassElement[] };
    return (payload.elements ?? []).flatMap((element, index) => {
      const lng = Number(element.lon ?? element.center?.lon);
      const lat = Number(element.lat ?? element.center?.lat);
      const name = element.tags?.name || element.tags?.brand;
      if (!name || !Number.isFinite(lng) || !Number.isFinite(lat)) return [];
      const street =
        element.tags?.["addr:full"] || element.tags?.["addr:street"] || "";
      return [
        {
          id: `osm-${element.id ?? index}`,
          name,
          address: street ? `${street} · OpenStreetMap` : "OpenStreetMap 店家／公司",
          location: { lng, lat },
        },
      ];
    });
  } catch {
    return [];
  } finally {
    clearTimeout(timer);
  }
}
