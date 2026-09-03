import { matchLandmarks } from "@/data/landmarks";
import { TAINAN_CENTER } from "@/lib/constants";
import {
  expandKeywordQueries,
  filterWithinSearchRadius,
  isDoorplateQuery,
  matchLocalPois,
  mergeSearchHits,
  rankSearchHits,
} from "@/lib/poi-search";
import { SEARCH_RADIUS_KM, SEARCH_RESULT_LIMIT } from "@/lib/search-constants";
import {
  describeRelaxedMatch,
  expandTaiwanGeocodeQueries,
  officialAddressQuery,
  parseTaiwanAddress,
} from "@/lib/taiwan-address";
import {
  crossCheckLandArea,
  describeLandCrossCheck,
  describeNlscHit,
  householdAddressConfigured,
  searchHouseholdAddresses,
  searchNlscMapHits,
} from "@/services/official-address";
import { searchOverpassPois } from "@/services/overpass-poi";
import type { GeocodeHit } from "@/types/domain";

const NOMINATIM = "https://nominatim.openstreetmap.org/search";
const PHOTON = "https://photon.komoot.io/api/";
const USER_AGENT =
  "NavPilot/0.1 (https://github.com/jin358-cmd/nav-map)";

type NominatimRow = {
  place_id: number;
  name?: string;
  display_name: string;
  lat: string;
  lon: string;
};

const mergeHits = mergeSearchHits;

async function searchNominatim(
  query: string,
  bias?: { lng: number; lat: number },
): Promise<NominatimRow[]> {
  const nominatim = new URL(NOMINATIM);
  nominatim.searchParams.set("format", "jsonv2");
  nominatim.searchParams.set("countrycodes", "tw");
  nominatim.searchParams.set("limit", "10");
  nominatim.searchParams.set("q", query);
  nominatim.searchParams.set("accept-language", "zh-TW");
  if (bias) {
    const padLng = SEARCH_RADIUS_KM / 101;
    const padLat = SEARCH_RADIUS_KM / 111;
    nominatim.searchParams.set(
      "viewbox",
      `${bias.lng - padLng},${bias.lat + padLat},${bias.lng + padLng},${bias.lat - padLat}`,
    );
    nominatim.searchParams.set("bounded", "0");
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 900);
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
    if (!response.ok) return [];
    const raw = (await response.json()) as NominatimRow[];
    return Array.isArray(raw) ? preferLocalRows(raw) : [];
  } catch {
    return [];
  } finally {
    clearTimeout(timer);
  }
}

function preferLocalRows(rows: NominatimRow[]) {
  return rows;
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
  photon.searchParams.set("limit", "10");
  photon.searchParams.set("lang", "zh");
  if (bias) {
    photon.searchParams.set("lon", String(bias.lng));
    photon.searchParams.set("lat", String(bias.lat));
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 900);
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
        original;
      return [
        {
          id: `photon-${feature.properties?.osm_id ?? index}`,
          name,
          address: describeRelaxedMatch(original, query, name),
          location: { lng, lat },
        },
      ];
    });
    return hits;
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
        name: osmName,
        address: describeRelaxedMatch(original, matchedQuery, item.display_name),
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
  const local = [
    ...matchLandmarks(query),
    ...matchLocalPois(query, bias),
  ];

  if (query.length < 2) {
    return Response.json({
      results: mergeHits(filterWithinSearchRadius(local, bias)),
    });
  }

  try {
    const parsed = parseTaiwanAddress(query);
    const officialQuery = officialAddressQuery(query);
    const doorplate = isDoorplateQuery(query);

    const toNlscHits = (rows: Awaited<ReturnType<typeof searchNlscMapHits>>) =>
      [...rows]
        .sort((a, b) => {
          const rank = (kind: typeof a.kind) =>
            kind === "ADDRESS" ? 0 : kind === "CROSSROAD" ? 1 : kind === "LANDGOAL" ? 2 : 3;
          return rank(a.kind) - rank(b.kind);
        })
        .map((item, index) => ({
          id: `nlsc-${item.kind}-${index}-${item.location.lng.toFixed(6)}-${item.location.lat.toFixed(6)}`,
          name: item.fullAddress,
          address: describeNlscHit(item),
          location: item.location,
        }));

    if (doorplate) {
      const nlscHits = toNlscHits(await searchNlscMapHits(officialQuery, bias, 1500));
      if (nlscHits.length) {
        return Response.json({
          results: mergeHits([...nlscHits, ...local]),
          source: "nlsc-doorplate",
          matchedQuery: officialQuery,
        });
      }

      if (parsed?.number && householdAddressConfigured()) {
        const official = await searchHouseholdAddresses(officialQuery);
        if (official.length) {
          const officialHits: GeocodeHit[] = official.map((item, index) => ({
            id: `tgos-${index}-${item.location.lng.toFixed(6)}-${item.location.lat.toFixed(6)}`,
            name: item.fullAddress,
            address: `戶政門牌 · ${item.matchType}`,
            location: item.location,
          }));
          const checked = parsed
            ? await withLandCrossCheck(officialHits, parsed, "內政部全國門牌")
            : officialHits;
          return Response.json({
            results: mergeHits([...checked, ...local]),
            source: "household-doorplate+land-check",
            matchedQuery: query,
          });
        }
      }
    }

    const keywordVariants = expandKeywordQueries(query);
    const variants = doorplate
      ? expandTaiwanGeocodeQueries(query)
      : keywordVariants;
    const poiQuery = keywordVariants[1] ?? keywordVariants[0] ?? query;
    const matchedQuery = variants[0] ?? query;

    const overpassPromise = doorplate
      ? Promise.resolve([] as GeocodeHit[])
      : searchOverpassPois(poiQuery, bias);
    const [nlscRows, nominatimRows, photonHits, overpassHits] = await Promise.all([
      searchNlscMapHits(officialQuery, bias, 900),
      searchNominatim(matchedQuery, bias),
      searchPhoton(poiQuery, query, bias),
      Promise.race([
        overpassPromise,
        sleep(700).then(() => [] as GeocodeHit[]),
      ]),
    ]);
    const nlscHits = toNlscHits(nlscRows);
    const remote = toHits(nominatimRows, query, matchedQuery);

    const pooled = rankSearchHits(
      filterWithinSearchRadius(
        mergeHits(
          [...local, ...nlscHits, ...remote, ...photonHits, ...overpassHits],
          48,
        ),
        bias,
      ),
      query,
      bias,
    );

    return Response.json({
      results: pooled.slice(0, SEARCH_RESULT_LIMIT),
      source: overpassHits.length
        ? "poi+overpass"
        : remote.length || photonHits.length
          ? "poi"
          : nlscHits.length
            ? "nlsc"
            : local.length
              ? "landmark"
              : "empty",
      matchedQuery,
    });
  } catch {
    return Response.json({ results: local, source: "landmark" });
  }
}
