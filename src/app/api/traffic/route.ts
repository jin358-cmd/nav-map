import { loadTainanTraffic } from "@/services/traffic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const fresh = url.searchParams.get("fresh") === "1";

  try {
    const catalog = await loadTainanTraffic(fresh);
    const source = catalog.origin === "tdx-live" ? "tdx" : "mock";
    return Response.json(
      {
        source,
        updatedAt: catalog.fetchedAt,
        traffic: catalog.segments,
        origin: catalog.origin,
        segments: catalog.segments,
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
    return Response.json(
      { error: "路況資料載入失敗" },
      { status: 502 },
    );
  }
}
