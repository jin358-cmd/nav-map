import { disasterPublishSource, loadTainanDisasters } from "@/services/disaster-api";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const fresh = url.searchParams.get("fresh") === "1";

  try {
    const catalog = await loadTainanDisasters(fresh);
    const source = disasterPublishSource(catalog.origin);
    return Response.json(
      {
        source,
        updatedAt: catalog.fetchedAt,
        disasters: catalog.alerts,
        origin: catalog.origin,
        alerts: catalog.alerts,
        fetchedAt: catalog.fetchedAt,
      },
      {
        headers: {
          "Cache-Control": fresh
            ? "no-store"
            : "private, max-age=30, stale-while-revalidate=60",
        },
      },
    );
  } catch {
    return Response.json({ error: "災害示警載入失敗" }, { status: 502 });
  }
}
