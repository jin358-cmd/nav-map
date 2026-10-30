import { loadRoadEventCatalog } from "@/services/road-events";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const includeTdx = url.searchParams.get("tdx") === "1";
  const summary = url.searchParams.get("summary") === "1";
  try {
    const catalog = await loadRoadEventCatalog({ includeTdx });
    const sources = catalog.sources.map((source) => ({
      sourceDataset: source.sourceDataset,
      ok: source.ok,
      error: source.error,
      updateTime: source.updateTime,
      rawCount: source.rawCount,
      uniqueCount: source.uniqueCount,
      byEventType: source.byEventType,
      withCoordinates: source.withCoordinates,
      activeCount: source.activeCount,
    }));
    return Response.json(
      {
        fetchedAt: catalog.fetchedAt,
        dedupedCount: catalog.dedupedCount,
        eventCount: catalog.events.length,
        sources,
        events: summary ? undefined : catalog.events,
      },
      { headers: { "Cache-Control": "private, max-age=60" } },
    );
  } catch {
    return Response.json({ error: "道路事件載入失敗" }, { status: 502 });
  }
}
