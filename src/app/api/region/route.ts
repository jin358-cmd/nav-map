import { DEFAULT_GEOCODE_CITY } from "@/lib/taiwan-address";
import { queryNlscTownVillage } from "@/services/official-address";
import type { LngLat } from "@/types/domain";

export const dynamic = "force-dynamic";

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

export async function GET(request: Request) {
  const location = parsePoint(request);
  if (!location) {
    return Response.json(
      { city: DEFAULT_GEOCODE_CITY, town: "", source: "default" },
      { status: 400 },
    );
  }

  const area = await queryNlscTownVillage(location);
  if (!area?.city) {
    return Response.json({
      city: DEFAULT_GEOCODE_CITY,
      town: "",
      source: "default",
    });
  }

  return Response.json({
    city: area.city.replaceAll("台", "臺"),
    town: area.town.replaceAll("台", "臺"),
    source: "nlsc",
  });
}
