import { formatTaiwanDisplayAddress } from "@/lib/geocoding/format-taiwan-display-address";
import type { GeocodeLookupMode } from "@/lib/geocoding/types";
import type { GeocodeHit, LngLat, RoutePlan, TravelMode } from "@/types/domain";

export async function reversePlace(location: LngLat): Promise<GeocodeHit> {
  const params = new URLSearchParams({
    lng: String(location.lng),
    lat: String(location.lat),
  });
  const response = await fetch(`/api/reverse?${params.toString()}`);
  if (!response.ok) {
    return {
      id: `custom-${location.lng.toFixed(5)}-${location.lat.toFixed(5)}`,
      name: "自訂位置",
      address: "長按地圖",
      location,
    };
  }
  const data = (await response.json()) as { result?: GeocodeHit };
  return (
    data.result ?? {
      id: `custom-${location.lng.toFixed(5)}-${location.lat.toFixed(5)}`,
      name: "自訂位置",
      address: "長按地圖",
      location,
    }
  );
}

const SEARCH_MEMORY_MS = 12_000;
const searchMemory = new Map<string, { at: number; hits: GeocodeHit[] }>();

function searchMemoryKey(
  query: string,
  bias: LngLat | undefined,
  mode: GeocodeLookupMode,
) {
  const lng = bias ? bias.lng.toFixed(2) : "";
  const lat = bias ? bias.lat.toFixed(2) : "";
  return `${mode}|${query.trim()}|${lng}|${lat}`;
}

export async function searchAddresses(
  query: string,
  bias?: LngLat,
  signal?: AbortSignal,
  mode: GeocodeLookupMode = "search",
): Promise<GeocodeHit[]> {
  const memoryKey = searchMemoryKey(query, bias, mode);
  const remembered = searchMemory.get(memoryKey);
  if (remembered && Date.now() - remembered.at < SEARCH_MEMORY_MS) {
    return remembered.hits;
  }
  const params = new URLSearchParams({ q: query, mode });
  if (bias) {
    params.set("lng", String(bias.lng));
    params.set("lat", String(bias.lat));
  }
  const response = await fetch(`/api/geocode?${params.toString()}`, { signal });
  if (!response.ok) {
    throw new Error("地址搜尋失敗");
  }
  const data = (await response.json()) as {
    results?: Array<
      GeocodeHit & {
        label?: string;
        formattedAddress?: string;
        latitude?: number;
        longitude?: number;
      }
    >;
  };
  const hits = (data.results ?? []).flatMap((item) => {
    const lng = item.location?.lng ?? item.longitude;
    const lat = item.location?.lat ?? item.latitude;
    if (!Number.isFinite(lng) || !Number.isFinite(lat)) return [];
    return [
      {
        id: item.id,
        name: formatTaiwanDisplayAddress(item.name || item.label || query),
        address: formatTaiwanDisplayAddress(
          item.address || item.formattedAddress || "",
        ),
        location: { lng: Number(lng), lat: Number(lat) },
        source: item.source,
        exactHouseNumber: item.exactHouseNumber,
        matchKind: item.matchKind,
        confidence: item.confidence,
        distanceMeters: item.distanceMeters,
      } satisfies GeocodeHit,
    ];
  });
  searchMemory.set(memoryKey, { at: Date.now(), hits });
  return hits;
}

export async function rememberGeocodeSelection(
  query: string,
  bias?: LngLat,
) {
  try {
    await fetch("/api/geocode", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query,
        lng: bias?.lng,
        lat: bias?.lat,
      }),
    });
  } catch {
    /* 快取計數失敗不影響導航 */
  }
}

export async function planDrivingRoute(
  from: LngLat,
  to: GeocodeHit,
  signal?: AbortSignal,
  mode: TravelMode = "car",
): Promise<RoutePlan> {
  const params = new URLSearchParams({
    fromLng: String(from.lng),
    fromLat: String(from.lat),
    toLng: String(to.location.lng),
    toLat: String(to.location.lat),
    label: to.name,
    mode,
  });
  const response = await fetch(`/api/directions?${params.toString()}`, {
    signal,
  });
  const data = (await response.json()) as RoutePlan & {
    error?: string;
    code?: string;
  };
  if (data.code === "NOT_CONFIGURED" || response.status === 501) {
    throw new Error("機車路線尚未設定（NOT CONFIGURED），目前供應商不支援機車模式。");
  }
  if (!response.ok || !data.coordinates?.length) {
    throw new Error(data.error || "路線規劃失敗");
  }
  return {
    ...data,
    steps: data.steps ?? [],
    destination: {
      ...data.destination,
      address: to.address,
    },
    travelMode: data.travelMode ?? mode,
  };
}
