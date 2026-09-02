import { matchLandmarks } from "@/data/landmarks";
import type { GeocodeHit } from "@/types/domain";

const NOMINATIM = "https://nominatim.openstreetmap.org/search";

function mergeHits(local: GeocodeHit[], remote: GeocodeHit[]) {
  const seen = new Set<string>();
  const rows: GeocodeHit[] = [];
  for (const hit of [...local, ...remote]) {
    const key = `${hit.name}|${hit.location.lng.toFixed(5)}|${hit.location.lat.toFixed(5)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    rows.push(hit);
  }
  return rows.slice(0, 8);
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const query = url.searchParams.get("q")?.trim() ?? "";
  const biasLng = Number(url.searchParams.get("lng"));
  const biasLat = Number(url.searchParams.get("lat"));
  const local = matchLandmarks(query);

  if (query.length < 2) {
    return Response.json({ results: local });
  }

  const nominatim = new URL(NOMINATIM);
  nominatim.searchParams.set("format", "jsonv2");
  nominatim.searchParams.set("countrycodes", "tw");
  nominatim.searchParams.set("limit", "6");
  nominatim.searchParams.set("q", query);
  nominatim.searchParams.set("accept-language", "zh-TW");
  if (Number.isFinite(biasLng) && Number.isFinite(biasLat)) {
    const pad = 0.35;
    nominatim.searchParams.set(
      "viewbox",
      `${biasLng - pad},${biasLat + pad},${biasLng + pad},${biasLat - pad}`,
    );
  }

  try {
    const response = await fetch(nominatim, {
      headers: {
        Accept: "application/json",
        "Accept-Language": "zh-TW",
        "User-Agent": "SmartRoadTaiwan/0.1 (https://github.com/jin358-cmd/nav-map)",
      },
      next: { revalidate: 1800 },
    });
    if (!response.ok) {
      return Response.json({ results: local, source: "landmark" });
    }
    const raw = (await response.json()) as Array<{
      place_id: number;
      name?: string;
      display_name: string;
      lat: string;
      lon: string;
    }>;
    const remote: GeocodeHit[] = raw
      .map((item) => ({
        id: `osm-${item.place_id}`,
        name: item.name || item.display_name.split(",")[0] || query,
        address: item.display_name,
        location: { lng: Number(item.lon), lat: Number(item.lat) },
      }))
      .filter(
        (item) =>
          Number.isFinite(item.location.lng) && Number.isFinite(item.location.lat),
      );
    return Response.json({
      results: mergeHits(local, remote),
      source: "nominatim",
    });
  } catch {
    return Response.json({ results: local, source: "landmark" });
  }
}
