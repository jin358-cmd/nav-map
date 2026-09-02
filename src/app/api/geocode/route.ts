import { matchLandmarks } from "@/data/landmarks";
import { TAINAN_CENTER } from "@/lib/constants";
import {
  describeRelaxedMatch,
  expandTaiwanGeocodeQueries,
  mentionsTainanCity,
  officialAddressQuery,
  parseTaiwanAddress,
} from "@/lib/taiwan-address";
import {
  crossCheckLandArea,
  describeLandCrossCheck,
  householdAddressConfigured,
  searchHouseholdAddresses,
} from "@/services/official-address";
import type { GeocodeHit } from "@/types/domain";

const NOMINATIM = "https://nominatim.openstreetmap.org/search";
const PHOTON = "https://photon.komoot.io/api/";
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
    nominatim.searchParams.set("bounded", "0");
  }

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8_000);
    try {
      const response = await fetch(nominatim, {
        headers: {
          Accept: "application/json",
          "Accept-Language": "zh-TW",
          "User-Agent": USER_AGENT,
        },
        cache: "no-store",
        signal: controller.signal,
      });
      if (response.status === 429) {
        await sleep(1100);
        continue;
      }
      if (!response.ok) return [];
      const raw = (await response.json()) as NominatimRow[];
      return Array.isArray(raw) ? preferLocalRows(raw) : [];
    } catch {
      return [];
    } finally {
      clearTimeout(timer);
    }
  }
  return [];
}

function preferLocalRows(rows: NominatimRow[]) {
  const tainan = rows.filter((row) => mentionsTainanCity(row.display_name));
  return tainan.length ? tainan : rows;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

type PhotonFeature = {
  geometry?: { coordinates?: number[] };
  properties?: { osm_id?: number; name?: string; city?: string; street?: string };
};

async function searchPhoton(
  query: string,
  original: string,
  bias?: { lng: number; lat: number },
): Promise<GeocodeHit[]> {
  const photon = new URL(PHOTON);
  photon.searchParams.set("q", query);
  photon.searchParams.set("limit", "6");
  photon.searchParams.set("lang", "zh");
  if (bias) {
    photon.searchParams.set("lon", String(bias.lng));
    photon.searchParams.set("lat", String(bias.lat));
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8_000);
  try {
    const response = await fetch(photon, {
      headers: { Accept: "application/json", "User-Agent": USER_AGENT },
      cache: "no-store",
      signal: controller.signal,
    });
    if (!response.ok) return [];
    const payload = (await response.json()) as { features?: PhotonFeature[] };
    const features = payload.features ?? [];
    const hits = features.flatMap((feature, index) => {
      const lng = Number(feature.geometry?.coordinates?.[0]);
      const lat = Number(feature.geometry?.coordinates?.[1]);
      if (!Number.isFinite(lng) || !Number.isFinite(lat)) return [];
      const name =
        feature.properties?.name ||
        feature.properties?.street ||
        query;
      return [
        {
          id: `photon-${feature.properties?.osm_id ?? index}`,
          name: original,
          address: describeRelaxedMatch(original, query, name),
          location: { lng, lat },
        },
      ];
    });
    const tainan = hits.filter((hit) =>
      mentionsTainanCity(`${hit.address}${hit.name}`),
    );
    return tainan.length ? tainan : hits;
  } catch {
    return [];
  } finally {
    clearTimeout(timer);
  }
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

async function withLandCrossCheck(
  hits: GeocodeHit[],
  expected: { city: string; town: string },
  sourceLabel: string,
) {
  return Promise.all(
    hits.map(async (hit) => {
      const check = await crossCheckLandArea(hit.location, expected);
      return {
        ...hit,
        address: `${hit.address} · ${sourceLabel} · ${describeLandCrossCheck(check)}`,
      };
    }),
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
      : { ...TAINAN_CENTER };
  const local = matchLandmarks(query);

  if (query.length < 2) {
    return Response.json({ results: local });
  }

  try {
    const parsed = parseTaiwanAddress(query);
    if (parsed?.number && householdAddressConfigured()) {
      const official = await searchHouseholdAddresses(officialAddressQuery(query));
      if (official.length) {
        const officialHits: GeocodeHit[] = official.map((item, index) => ({
          id: `tgos-${index}-${item.location.lng.toFixed(6)}-${item.location.lat.toFixed(6)}`,
          name: item.fullAddress,
          address: `戶政門牌 · ${item.matchType}`,
          location: item.location,
        }));
        const checked = await withLandCrossCheck(
          officialHits,
          parsed,
          "內政部全國門牌",
        );
        return Response.json({
          results: mergeHits([...checked, ...local]),
          source: "household-doorplate+land-check",
          matchedQuery: query,
        });
      }
    }

    const variants = expandTaiwanGeocodeQueries(query);
    let remote: GeocodeHit[] = [];
    let matchedQuery = query;
    for (const [index, variant] of variants.entries()) {
      if (index > 0) await sleep(1100);
      const rows = await searchNominatim(variant, bias);
      if (!rows.length) continue;
      matchedQuery = variant;
      remote = toHits(rows, query, variant);
      break;
    }

    if (!remote.length) {
      for (const variant of variants.slice(0, 3)) {
        remote = await searchPhoton(variant, query, bias);
        if (!remote.length) continue;
        matchedQuery = variant;
        break;
      }
    }

    if (parsed && remote.length) {
      remote = await withLandCrossCheck(
        remote,
        parsed,
        "開放地圖後備定位",
      );
    }

    return Response.json({
      results: mergeHits([...local, ...remote]),
      source: remote.length
        ? parsed
          ? "open-map+land-check"
          : "nominatim"
        : local.length
          ? "landmark"
          : "empty",
      matchedQuery,
    });
  } catch {
    return Response.json({ results: local, source: "landmark" });
  }
}
