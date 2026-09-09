import { isConvenienceKind } from "@/lib/poi/convenience-kind";
import { isEnergyKind } from "@/lib/poi/energy-kind";
import { isHotelKind } from "@/lib/poi/hotel-kind";
import { isRestaurantKind } from "@/lib/poi/restaurant-kind";
import { POI_MAIN_LAYER_IDS, type PoiMainLayerId } from "@/lib/poi/main-layers";
import { poisInBounds, poisNearby } from "@/lib/poi/server-index";
import { POI_CATEGORIES, type PoiCategory, type TaiwanPoiRecord } from "@/lib/poi/schema";

function readNumber(value: string | null) {
  if (!value) return undefined;
  const number = Number(value);
  return Number.isFinite(number) ? number : undefined;
}

function readCategories(value: string | null): PoiCategory[] | undefined {
  if (!value) return undefined;
  const wanted = new Set(POI_CATEGORIES);
  const categories = value
    .split(",")
    .map((item) => item.trim())
    .filter((item): item is PoiCategory => wanted.has(item as PoiCategory));
  return categories.length ? categories : undefined;
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

function serializePoi(poi: TaiwanPoiRecord) {
  return {
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
    phone: poi.phone || null,
  };
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const west = readNumber(url.searchParams.get("west"));
  const south = readNumber(url.searchParams.get("south"));
  const east = readNumber(url.searchParams.get("east"));
  const north = readNumber(url.searchParams.get("north"));
  const lng = readNumber(url.searchParams.get("lng"));
  const lat = readNumber(url.searchParams.get("lat"));
  const radius = readNumber(url.searchParams.get("radius")) ?? 2600;
  const limit = readNumber(url.searchParams.get("limit")) ?? 80;
  const requested = readLayers(url.searchParams.get("layers"));
  const categories = readCategories(url.searchParams.get("categories"));
  const layers = requested ?? [...POI_MAIN_LAYER_IDS];
  const preferPhone = url.searchParams.get("preferPhone") === "1";
  const energyParam = url.searchParams.get("energyKind");
  const energyKind = isEnergyKind(energyParam) ? energyParam : undefined;
  const convenienceParam = url.searchParams.get("convenienceKind");
  const convenienceKind = isConvenienceKind(convenienceParam)
    ? convenienceParam
    : undefined;
  const restaurantParam = url.searchParams.get("restaurantKind");
  const restaurantKind = isRestaurantKind(restaurantParam)
    ? restaurantParam
    : undefined;
  const hotelParam = url.searchParams.get("hotelKind");
  const hotelKind = isHotelKind(hotelParam) ? hotelParam : undefined;
  const origin =
    lng !== undefined && lat !== undefined ? { lng, lat } : undefined;

  if (url.searchParams.get("nearby") === "1") {
    if (
      !origin ||
      origin.lng < 118 ||
      origin.lng > 123 ||
      origin.lat < 20 ||
      origin.lat > 27
    ) {
      return Response.json({ error: "請提供臺灣範圍內的定位點" }, { status: 400 });
    }
    const rows = poisNearby(
      origin,
      radius,
      categories ? undefined : layers,
      Math.min(limit, 24),
      preferPhone,
      categories,
      energyKind,
      convenienceKind,
      restaurantKind,
      hotelKind,
    );
    return Response.json(
      { pois: rows.map(serializePoi) },
      {
        headers: {
          "Cache-Control": "public, max-age=15, s-maxage=15, stale-while-revalidate=60",
        },
      },
    );
  }

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

  const rows = poisInBounds({ west, south, east, north }, origin, limit, layers);
  return Response.json(
    {
      pois: rows.map(serializePoi),
    },
    {
      headers: {
        "Cache-Control": "public, max-age=15, s-maxage=15, stale-while-revalidate=60",
      },
    },
  );
}
