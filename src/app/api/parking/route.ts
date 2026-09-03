import { loadNearbyParking } from "@/services/parking";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const lat = Number(url.searchParams.get("lat"));
  const lng = Number(url.searchParams.get("lng"));
  const radiusKm = Number(url.searchParams.get("radiusKm") ?? 4);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return Response.json({ error: "缺少查詢座標" }, { status: 400 });
  }
  try {
    const catalog = await loadNearbyParking(
      { lat, lng },
      Number.isFinite(radiusKm) ? Math.min(Math.max(radiusKm, 3), 5) : 4,
    );
    return Response.json({
      origin: catalog.origin,
      lots: catalog.lots,
      fetchedAt: catalog.fetchedAt,
      source:
        catalog.origin === "tdx-live"
          ? "tdx"
          : catalog.origin === "tainan-open"
            ? "tainan-open"
            : "unavailable",
    });
  } catch {
    return Response.json({ error: "停車資料載入失敗" }, { status: 502 });
  }
}
