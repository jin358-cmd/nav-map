import { POI_MAIN_LAYER_IDS, type PoiMainLayerId } from "@/lib/poi/main-layers";
import { poisInBounds } from "@/lib/poi/server-index";

function readNumber(value: string | null) {
  if (!value) return undefined;
  const number = Number(value);
  return Number.isFinite(number) ? number : undefined;
}

function readLayers(value: string | null): PoiMainLayerId[] | undefined {
  if (!value) return undefined;
  const wanted = new Set(POI_MAIN_LAYER_IDS);
  const layers = value
    .split(",")
    .map((item) => item.trim())
    .filter((item): item is PoiMainLayerId => wanted.has(item as PoiMainLayerId));
  return layers.length ? layers : undefined;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const west = readNumber(url.searchParams.get("west"));
  const south = readNumber(url.searchParams.get("south"));
  const east = readNumber(url.searchParams.get("east"));
  const north = readNumber(url.searchParams.get("north"));
  const lng = readNumber(url.searchParams.get("lng"));
  const lat = readNumber(url.searchParams.get("lat"));
  const limit = readNumber(url.searchParams.get("limit")) ?? 80;
  const layers = readLayers(url.searchParams.get("layers"));

  if (
    west === undefined ||
    south === undefined ||
    east === undefined ||
    north === undefined ||
    west < 118 ||
    east > 123 ||
    south < 20 ||
    north > 27
  ) {
    return Response.json({ error: "請提供臺灣範圍內的地圖視野" }, { status: 400 });
  }

  const origin =
    lng !== undefined && lat !== undefined ? { lng, lat } : undefined;
  const rows = poisInBounds({ west, south, east, north }, origin, limit, layers);
  return Response.json(
    {
      pois: rows.map((poi) => ({
        id: poi.id,
        name: poi.name,
        category: poi.category,
        mainLayer: poi.mainCategory,
        subcategory: poi.subcategory,
        brand: poi.brand,
        branchName: poi.branchName,
        address: poi.address,
        location: { lng: poi.longitude, lat: poi.latitude },
        source: poi.source,
        updatedAt: poi.updatedAt,
      })),
    },
    {
      headers: {
        "Cache-Control": "public, s-maxage=60, stale-while-revalidate=180",
      },
    },
  );
}
