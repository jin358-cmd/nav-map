import { loadTainanTraffic } from "@/services/traffic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const fresh = url.searchParams.get("fresh") === "1";

  try {
    const catalog = await loadTainanTraffic(fresh);
    return Response.json(catalog);
  } catch {
    return Response.json(
      { error: "路況資料載入失敗" },
      { status: 502 },
    );
  }
}
