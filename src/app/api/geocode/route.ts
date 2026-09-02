import { matchLandmarks } from "@/data/landmarks";
import {
  describeRelaxedMatch,
  expandTaiwanGeocodeQueries,
} from "@/lib/taiwan-address";
import type { GeocodeHit } from "@/types/domain";

const NOMINATIM = "https://nominatim.openstreetmap.org/search";
const USER_AGENT =
  "SmartRoadTaiwan/0.1 (https://github.com/jin358-cmd/nav-map)";

type NominatimRow = {
  place_id: number;
  name?: string;
  display_name: string;
  lat: string;
  lon: string;
};

function mergeHits(rows: GeocodeHit[]) {
  const seen = new Set<string>();
  const out: GeocodeHit[] = [];
  for (const hit of rows) {
    const key = `${hit.name}|${hit.location.lng.toFixed(5)}|${hit.location.lat.toFixed(5)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(hit);
  }
  return out.slice(0, 8);
}

async function searchNominatim(
  query: string,
  bias?: { lng: number; lat: number },
): Promise<NominatimRow[]> {
  const nominatim = new URL(NOMINATIM);
  nominatim.searchParams.set("format", "jsonv2");
  nominatim.searchParams.set("countrycodes", "tw");
  nominatim.searchParams.set("limit", "6");
  nominatim.searchParams.set("q", query);
  nominatim.searchParams.set("accept-language", "zh-TW");
  if (bias) {
    const pad = 0.45;
    nominatim.searchParams.set(
      "viewbox",
      `${bias.lng - pad},${bias.lat + pad},${bias.lng + pad},${bias.lat - pad}`,
    );
  }

  const response = await fetch(nominatim, {
    headers: {
      Accept: "application/json",
      "Accept-Language": "zh-TW",
      "User-Agent": USER_AGENT,
    },
    cache: "no-store",
  });
  if (!response.ok) return [];
  const raw = (await response.json()) as NominatimRow[];
  return Array.isArray(raw) ? raw : [];
}

function toHits(
  raw: NominatimRow[],
  original: string,
  matchedQuery: string,
): GeocodeHit[] {
  return raw
    .map((item) => {
      const osmName = item.name || item.display_name.split(",")[0] || original;
      return {
        id: `osm-${item.place_id}`,
        name: original,
        address: describeRelaxedMatch(original, matchedQuery, osmName),
        location: { lng: Number(item.lon), lat: Number(item.lat) },
      };
    })
    .filter(
      (item) =>
        Number.isFinite(item.location.lng) && Number.isFinite(item.location.lat),
    );
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const query = url.searchParams.get("q")?.trim() ?? "";
  const biasLng = Number(url.searchParams.get("lng"));
  const biasLat = Number(url.searchParams.get("lat"));
  const bias =
    Number.isFinite(biasLng) && Number.isFinite(biasLat)
      ? { lng: biasLng, lat: biasLat }
      : undefined;
  const local = matchLandmarks(query);

  if (query.length < 2) {
    return Response.json({ results: local });
  }

  try {
    const variants = expandTaiwanGeocodeQueries(query);
    let remote: GeocodeHit[] = [];
    let matchedQuery = query;
    for (const variant of variants) {
      const rows = await searchNominatim(variant, bias);
      if (!rows.length) continue;
      matchedQuery = variant;
      remote = toHits(rows, query, variant);
      break;
    }

    return Response.json({
      results: mergeHits([...local, ...remote]),
      source: remote.length ? "nominatim" : local.length ? "landmark" : "empty",
      matchedQuery,
    });
  } catch {
    return Response.json({ results: local, source: "landmark" });
  }
}
