import { loadRoadworkCatalog, structuralRoadworkCatalog } from "@/services/roadwork";

export const runtime = "nodejs";
export const revalidate = 300;

export async function GET(request: Request) {
  const url = new URL(request.url);
  const structural =
    process.env.NODE_ENV !== "production" && url.searchParams.get("sample") === "structural";

  try {
    const catalog = structural ? structuralRoadworkCatalog() : await loadRoadworkCatalog();
    return Response.json(catalog, {
      headers: {
        "Cache-Control": structural ? "no-store" : "public, s-maxage=300, stale-while-revalidate=600",
      },
    });
  } catch {
    return Response.json(
      {
        origin: "degraded",
        degradedReason: "upstream",
        fetchedAt: new Date().toISOString(),
        previewLabel: null,
        mapEvents: [],
        notices: [],
        counts: { input: 0, unique: 0, mapVisible: 0, notices: 0 },
        closureAvoidanceEnabled: false,
      },
      { status: 200, headers: { "Cache-Control": "no-store" } },
    );
  }
}
