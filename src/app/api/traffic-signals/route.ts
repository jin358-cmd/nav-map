import { loadTrafficSignals } from "@/services/traffic-signals";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const west = Number(url.searchParams.get("west"));
  const south = Number(url.searchParams.get("south"));
  const east = Number(url.searchParams.get("east"));
  const north = Number(url.searchParams.get("north"));
  const zoom = Number(url.searchParams.get("zoom"));
  const centerLng = Number(url.searchParams.get("centerLng"));
  const centerLat = Number(url.searchParams.get("centerLat"));
  const center =
    Number.isFinite(centerLng) && Number.isFinite(centerLat)
      ? { lng: centerLng, lat: centerLat }
      : null;
  try {
    return Response.json(
      loadTrafficSignals({ west, south, east, north, zoom, center }),
      { headers: { "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=86400" } },
    );
  } catch {
    return Response.json(
      {
        origin: "tainan-110-static",
        liveCountdown: "blocked",
        reason: "unavailable",
        signals: [],
      },
      { status: 200, headers: { "Cache-Control": "no-store" } },
    );
  }
}
