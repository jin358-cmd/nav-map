import { PARKING_DEFAULT_RADIUS_M } from "@/lib/parking/constants";
import { loadNearbyParkingLots } from "@/lib/parking/nearby";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const lat = Number(url.searchParams.get("lat"));
  const lng = Number(url.searchParams.get("lng"));
  const radius = Number(
    url.searchParams.get("radius") ??
      url.searchParams.get("radiusMeters") ??
      PARKING_DEFAULT_RADIUS_M,
  );
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return Response.json({ error: "缺少查詢座標" }, { status: 400 });
  }
  try {
    const catalog = await loadNearbyParkingLots({ lat, lng }, radius);
    return Response.json({
      origin: catalog.origin,
      lots: catalog.lots,
      fetchedAt: catalog.fetchedAt,
      radiusMeters: Number.isFinite(radius) ? radius : PARKING_DEFAULT_RADIUS_M,
      source: catalog.origin,
    });
  } catch {
    return Response.json({ error: "停車資料載入失敗" }, { status: 502 });
  }
}
