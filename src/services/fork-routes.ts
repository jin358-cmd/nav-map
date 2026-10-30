import type { LngLat, RoutePlan, TravelMode } from "@/types/domain";

export async function fetchForkRoutes(args: {
  from: LngLat;
  to: LngLat;
  label: string;
  mode: TravelMode;
  via?: LngLat;
  signal?: AbortSignal;
}): Promise<RoutePlan[]> {
  const params = new URLSearchParams({
    fromLng: String(args.from.lng),
    fromLat: String(args.from.lat),
    toLng: String(args.to.lng),
    toLat: String(args.to.lat),
    label: args.label,
    mode: args.mode,
  });
  if (args.via) {
    params.set("viaLng", String(args.via.lng));
    params.set("viaLat", String(args.via.lat));
  } else {
    params.set("alternatives", "1");
  }
  try {
    const response = await fetch(`/api/directions/fork?${params.toString()}`, {
      signal: args.signal,
      cache: "no-store",
    });
    if (!response.ok) return [];
    const data = (await response.json()) as { routes?: RoutePlan[] };
    return (data.routes ?? []).filter(
      (route) => Array.isArray(route.coordinates) && route.coordinates.length >= 2,
    );
  } catch {
    return [];
  }
}
