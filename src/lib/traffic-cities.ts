import { TDX_PARKING_CITIES } from "@/lib/parking-cities";

/**
 * Cities accepted by TDX Swagger `GET /v2/Road/Traffic/Live/City/{City}`
 * (basic Road Traffic API, verified 2026-10-30). YunlinCounty is first.
 */
export const TDX_LIVE_TRAFFIC_CITIES = [
  "YunlinCounty",
  "YilanCounty",
  "ChanghuaCounty",
  "PingtungCounty",
  "Keelung",
  "Taipei",
  "Kaohsiung",
  "Taichung",
  "Tainan",
  "Taoyuan",
] as const;

export type LiveTrafficCity = (typeof TDX_LIVE_TRAFFIC_CITIES)[number];

export type TrafficBounds = {
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
};

export function isLiveTrafficCity(value: string): value is LiveTrafficCity {
  return (TDX_LIVE_TRAFFIC_CITIES as readonly string[]).includes(value);
}

export function liveTrafficCityAt(
  point: { lng: number; lat: number } | null,
): LiveTrafficCity | null {
  if (!point || !Number.isFinite(point.lng) || !Number.isFinite(point.lat)) {
    return null;
  }
  const hits = TDX_PARKING_CITIES.filter(
    (city) =>
      isLiveTrafficCity(city.id) &&
      point.lat >= city.minLat &&
      point.lat <= city.maxLat &&
      point.lng >= city.minLng &&
      point.lng <= city.maxLng,
  );
  if (!hits.length) return null;
  hits.sort((a, b) => area(a) - area(b));
  const id = hits[0]?.id;
  return id && isLiveTrafficCity(id) ? id : null;
}

export function trafficCityBounds(city: string): TrafficBounds | null {
  const found = TDX_PARKING_CITIES.find((item) => item.id === city);
  if (!found) return null;
  return {
    minLat: found.minLat,
    maxLat: found.maxLat,
    minLng: found.minLng,
    maxLng: found.maxLng,
  };
}

export function padBounds(bounds: TrafficBounds, pad = 0.02): TrafficBounds {
  return {
    minLat: bounds.minLat - pad,
    maxLat: bounds.maxLat + pad,
    minLng: bounds.minLng - pad,
    maxLng: bounds.maxLng + pad,
  };
}

function area(bounds: TrafficBounds) {
  return (bounds.maxLat - bounds.minLat) * (bounds.maxLng - bounds.minLng);
}
