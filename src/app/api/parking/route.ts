import { loadNearbyParkingLots } from "@/lib/parking/nearby";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const lat = Number(url.searchParams.get("lat"));
  const lng = Number(url.searchParams.get("lng"));
  const radiusKm = Number(url.searchParams.get("radiusKm") ?? 3);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return Response.json({ error: "缺少查詢座標" }, { status: 400 });
  }
  try {
    const radiusMeters = Number.isFinite(radiusKm)
      ? Math.round(Math.min(Math.max(radiusKm, 0.2), 5) * 1000)
      : 3000;
    const catalog = await loadNearbyParkingLots({ lat, lng }, radiusMeters);
    return Response.json({
      origin: catalog.origin,
      lots: catalog.lots,
      fetchedAt: catalog.fetchedAt,
      source: catalog.origin,
    });
  } catch {
    return Response.json({ error: "停車資料載入失敗" }, { status: 502 });
  }
}
