import { fetchDisasterCatalog } from "@/services/disasters";

export const runtime = "nodejs";
export const revalidate = 120;

export async function GET(request: Request) {
  const url = new URL(request.url);
  const fresh = url.searchParams.get("fresh") === "1";

  try {
    const catalog = await fetchDisasterCatalog();
    const source = catalog.origin === "ncdr-live" ? "ncdr" : "mock";
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
            : "public, s-maxage=120, stale-while-revalidate=300",
        },
      },
    );
  } catch {
    return Response.json({ error: "災害示警載入失敗" }, { status: 502 });
  }
}
