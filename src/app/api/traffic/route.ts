import { isLiveTrafficCity } from "@/lib/traffic-cities";
import { TRAFFIC_LIVE_CACHE_MS, TRAFFIC_STALE_AFTER_MS } from "@/lib/traffic-constants";
import { loadCityTraffic } from "@/services/traffic";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const city = url.searchParams.get("city")?.trim() || "Tainan";
  const fresh = url.searchParams.get("fresh") === "1";
  if (!isLiveTrafficCity(city)) {
    return Response.json({ error: "不支援的縣市路況" }, { status: 400 });
  }

  try {
    const result = await loadCityTraffic(city, fresh);
    const catalog = result.catalog;
    const stale =
      catalog.origin === "tdx-live" &&
      Date.now() - new Date(catalog.updatedAt).getTime() > TRAFFIC_STALE_AFTER_MS;
    return Response.json(
      {
        source: catalog.source,
        updatedAt: catalog.updatedAt ?? catalog.fetchedAt,
        traffic: catalog.segments,
        origin: catalog.origin,
        segments: catalog.segments,
        fetchedAt: catalog.fetchedAt,
        stale: catalog.stale || stale,
        city,
        summary: result.stats,
        cache: result.cache,
        cacheTtlMs: result.cacheTtlMs,
        pollMs: result.pollMs,
        cacheAgeMs: result.cacheAgeMs,
      },
      {
        headers: {
          "Cache-Control": fresh
            ? "no-store"
            : `public, s-maxage=${Math.round(TRAFFIC_LIVE_CACHE_MS / 1000)}, stale-while-revalidate=${Math.round(TRAFFIC_LIVE_CACHE_MS / 1000)}`,
          "X-Traffic-Cache": result.cache,
        },
      },
    );
  } catch {
    return Response.json({ error: "路況資料載入失敗" }, { status: 502 });
  }
}
