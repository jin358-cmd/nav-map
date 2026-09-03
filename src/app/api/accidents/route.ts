import { loadAccidentCatalog } from "@/services/tdx-events";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const fresh = url.searchParams.get("fresh") === "1";
  try {
    const catalog = await loadAccidentCatalog();
    return Response.json(
      {
        origin: catalog.origin,
        items: catalog.items,
        accidents: catalog.items,
        fetchedAt: catalog.fetchedAt,
        source: catalog.origin === "tdx-live" ? "tdx" : catalog.origin,
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
    return Response.json({ error: "事故資料載入失敗" }, { status: 502 });
  }
}
