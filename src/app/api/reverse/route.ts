import { DEFAULT_GEOCODE_CITY } from "@/lib/taiwan-address";
import { queryNlscTownVillage } from "@/services/official-address";
import type { GeocodeHit, LngLat } from "@/types/domain";

export const dynamic = "force-dynamic";

const NOMINATIM_REVERSE = "https://nominatim.openstreetmap.org/reverse";
const USER_AGENT = "NavPilot/0.1 (https://github.com/jin358-cmd/nav-map)";

function parsePoint(request: Request): LngLat | null {
  const url = new URL(request.url);
  const lng = Number(url.searchParams.get("lng"));
  const lat = Number(url.searchParams.get("lat"));
  if (
    !Number.isFinite(lng) ||
    !Number.isFinite(lat) ||
    lng < 118 ||
    lng > 123 ||
    lat < 20 ||
    lat > 27
  ) {
    return null;
  }
  return { lng, lat };
}

async function nominatimReverse(location: LngLat) {
  const url = new URL(NOMINATIM_REVERSE);
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("lat", String(location.lat));
  url.searchParams.set("lon", String(location.lng));
  url.searchParams.set("accept-language", "zh-TW");
  url.searchParams.set("zoom", "18");
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5_000);
  try {
    const response = await fetch(url, {
      headers: {
        Accept: "application/json",
        "Accept-Language": "zh-TW",
        "User-Agent": USER_AGENT,
      },
      cache: "no-store",
      signal: controller.signal,
    });
    if (!response.ok) return null;
    const data = (await response.json()) as {
      name?: string;
      display_name?: string;
    };
    return data;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export async function GET(request: Request) {
  const location = parsePoint(request);
  if (!location) {
    return Response.json({ error: "座標無效" }, { status: 400 });
  }

  const [area, osm] = await Promise.all([
    queryNlscTownVillage(location),
    nominatimReverse(location),
  ]);
  const city = (area?.city || DEFAULT_GEOCODE_CITY).replaceAll("台", "臺");
  const town = (area?.town || "").replaceAll("台", "臺");
  const name =
    osm?.name?.trim() ||
    (town ? `${town}自訂位置` : "自訂位置");
  const address =
    osm?.display_name?.trim() ||
    [city, town, "長按地圖"].filter(Boolean).join("");

  const hit: GeocodeHit = {
    id: `custom-${location.lng.toFixed(5)}-${location.lat.toFixed(5)}`,
    name,
    address,
    location,
  };
  return Response.json({ result: hit, city, town, source: osm ? "nlsc+osm" : "nlsc" });
}
