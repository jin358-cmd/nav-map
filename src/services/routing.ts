import type { GeocodeHit, LngLat, RoutePlan } from "@/types/domain";

export async function searchAddresses(
  query: string,
  bias?: LngLat,
): Promise<GeocodeHit[]> {
  const params = new URLSearchParams({ q: query });
  if (bias) {
    params.set("lng", String(bias.lng));
    params.set("lat", String(bias.lat));
  }
  const response = await fetch(`/api/geocode?${params.toString()}`);
  if (!response.ok) {
    throw new Error("地址搜尋失敗");
  }
  const data = (await response.json()) as { results?: GeocodeHit[] };
  return data.results ?? [];
}

export async function planDrivingRoute(
  from: LngLat,
  to: GeocodeHit,
): Promise<RoutePlan> {
  const params = new URLSearchParams({
    fromLng: String(from.lng),
    fromLat: String(from.lat),
    toLng: String(to.location.lng),
    toLat: String(to.location.lat),
    label: to.name,
  });
  const response = await fetch(`/api/directions?${params.toString()}`);
  const data = (await response.json()) as RoutePlan & { error?: string };
  if (!response.ok || !data.coordinates?.length) {
    throw new Error(data.error || "路線規劃失敗");
  }
  return {
    ...data,
    destination: {
      ...data.destination,
      address: to.address,
    },
  };
}
