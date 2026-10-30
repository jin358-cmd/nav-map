import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  buildCountyTraffic,
  envelopesFromBundle,
  readTdxEnvelope,
  type CountyTrafficBundle,
} from "@/lib/traffic-congestion";
import { trafficCityBounds } from "@/lib/traffic-cities";
import {
  TDX_API_BASE,
  TDX_PAGE_SIZE,
  TDX_TOKEN_URL,
  TRAFFIC_LIVE_CACHE_MS,
  TRAFFIC_SHAPE_CACHE_MS,
} from "@/lib/traffic-constants";
import type { TdxLiveRow, TdxSectionRow, TdxShapeRow } from "@/lib/traffic-normalize";
import type {
  TdxCongestionDefinition,
  TdxLinkRow,
} from "@/lib/traffic-congestion";

const fixturePath = join(process.cwd(), "fixtures/tdx/yunlin-traffic.json");

function fixtureBundles() {
  const fixture = JSON.parse(readFileSync(fixturePath, "utf8")) as {
    city: Parameters<typeof envelopesFromBundle>[0];
    highway: Parameters<typeof envelopesFromBundle>[0];
  };
  return {
    city: envelopesFromBundle(fixture.city),
    highway: envelopesFromBundle(fixture.highway),
  };
}

function summarize(
  mode: string,
  city: CountyTrafficBundle,
  highway: CountyTrafficBundle,
  extra: Record<string, unknown> = {},
) {
  const started = Date.now();
  const built = buildCountyTraffic({
    city: "YunlinCounty",
    origin: mode === "live" ? "tdx-live" : "tdx-fixture",
    cityBundle: city,
    highwayBundle: highway,
    bounds: trafficCityBounds("YunlinCounty"),
  });
  return {
    mode,
    city: "YunlinCounty",
    sectionsFetched: built.stats.sectionsFetched,
    cityLive: built.stats.cityLive,
    highwayLiveFetched: built.stats.highwayLive,
    highwayInCounty: built.stats.highwayInCounty,
    geometryMatched: built.stats.geometryMatched,
    endpointFallback: built.stats.endpointFallback,
    unmatchedGeometry: built.stats.unmatchedGeometry,
    green: built.stats.green,
    yellow: built.stats.yellow,
    red: built.stats.red,
    unknown: built.stats.unknown,
    sectionLinks: built.stats.sectionLinks,
    definitionGroups: built.stats.definitionGroups,
    cacheTtlMs: TRAFFIC_LIVE_CACHE_MS,
    shapeCacheMs: TRAFFIC_SHAPE_CACHE_MS,
    pollMs: TRAFFIC_LIVE_CACHE_MS,
    joinElapsedMs: Date.now() - started,
    credentialValuesRead: false,
    ...extra,
  };
}

async function fetchCollection<T>(
  token: string,
  path: string,
  legacyKeys: string[],
  select?: string,
  maxPages = 4,
) {
  const items: T[] = [];
  let authorityCode = "";
  let updateTime: string | undefined;
  let updateIntervalSec: number | undefined;
  for (let page = 0; page < maxPages; page += 1) {
    const url = new URL(`${TDX_API_BASE}${path}`);
    url.searchParams.set("$format", "JSON");
    url.searchParams.set("$top", String(TDX_PAGE_SIZE));
    if (page > 0) url.searchParams.set("$skip", String(page * TDX_PAGE_SIZE));
    if (select) url.searchParams.set("$select", select);
    const response = await fetch(url, {
      headers: { Accept: "application/json", Authorization: `Bearer ${token}` },
    });
    if (!response.ok) {
      throw new Error(`TDX ${path} ${response.status}`);
    }
    const envelope = readTdxEnvelope<T>(await response.json(), legacyKeys);
    if (!authorityCode) authorityCode = envelope.authorityCode;
    updateTime ??= envelope.updateTime;
    updateIntervalSec ??= envelope.updateIntervalSec;
    items.push(...envelope.items);
    if (envelope.items.length < TDX_PAGE_SIZE) break;
    if (envelope.count !== undefined && items.length >= envelope.count) break;
  }
  return { authorityCode, updateTime, updateIntervalSec, items };
}

async function fetchLiveBundles(token: string) {
  const liveSelect =
    "SectionID,SubAuthorityCode,TravelTime,TravelSpeed,CongestionLevelID,CongestionLevel,DataCollectTime";
  const sectionSelect =
    "SectionID,SubAuthorityCode,SectionName,RoadName,RoadClass,RoadDirection,SectionStart,SectionEnd";
  const shapeSelect = "SectionID,SubAuthorityCode,Geometry";
  const linkSelect = "SectionID,SubAuthorityCode,StartLinkID,EndLinkID,LinkIDs";
  const [live, sections, shapes, links, levels, highwayLive, highwaySections, highwayShapes, highwayLinks, highwayLevels] =
    await Promise.all([
      fetchCollection<TdxLiveRow>(token, "/v2/Road/Traffic/Live/City/YunlinCounty", ["LiveTraffics"], liveSelect),
      fetchCollection<TdxSectionRow>(token, "/v2/Road/Traffic/Section/City/YunlinCounty", ["Sections"], sectionSelect),
      fetchCollection<TdxShapeRow>(token, "/v2/Road/Traffic/SectionShape/City/YunlinCounty", ["SectionShapes"], shapeSelect),
      fetchCollection<TdxLinkRow>(token, "/v2/Road/Traffic/SectionLink/City/YunlinCounty", ["SectionLinks"], linkSelect),
      fetchCollection<TdxCongestionDefinition>(token, "/v2/Road/Traffic/CongestionLevel/City/YunlinCounty", ["CongestionLevels"]),
      fetchCollection<TdxLiveRow>(token, "/v2/Road/Traffic/Live/Highway", ["LiveTraffics"], liveSelect, 8),
      fetchCollection<TdxSectionRow>(token, "/v2/Road/Traffic/Section/Highway", ["Sections"], sectionSelect, 8),
      fetchCollection<TdxShapeRow>(token, "/v2/Road/Traffic/SectionShape/Highway", ["SectionShapes"], shapeSelect, 8),
      fetchCollection<TdxLinkRow>(token, "/v2/Road/Traffic/SectionLink/Highway", ["SectionLinks"], linkSelect, 8),
      fetchCollection<TdxCongestionDefinition>(token, "/v2/Road/Traffic/CongestionLevel/Highway", ["CongestionLevels"]),
    ]);
  const city: CountyTrafficBundle = { live, sections, shapes, links, levels };
  const highway: CountyTrafficBundle = {
    live: highwayLive,
    sections: highwaySections,
    shapes: highwayShapes,
    links: highwayLinks,
    levels: highwayLevels,
  };
  return { city, highway };
}

async function accessToken() {
  const clientId = process.env.TDX_CLIENT_ID?.trim() ?? "";
  const clientSecret = process.env.TDX_CLIENT_SECRET?.trim() ?? "";
  if (!clientId || !clientSecret) return null;
  const response = await fetch(TDX_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      client_id: clientId,
      client_secret: clientSecret,
    }),
  });
  if (!response.ok) {
    throw new Error(`TDX token ${response.status}`);
  }
  const json = (await response.json()) as { access_token?: string };
  if (!json.access_token) throw new Error("TDX token missing access_token");
  return json.access_token;
}

async function main() {
  const token = await accessToken();
  if (!token) {
    const bundles = fixtureBundles();
    console.log(
      JSON.stringify(
        summarize("fixture", bundles.city, bundles.highway, {
          liveYunlin:
            "pending server credentials TDX_CLIENT_ID and TDX_CLIENT_SECRET",
        }),
        null,
        2,
      ),
    );
    return;
  }

  const started = Date.now();
  const bundles = await fetchLiveBundles(token);
  console.log(
    JSON.stringify(
      summarize("live", bundles.city, bundles.highway, {
        liveFetchMs: Date.now() - started,
        liveYunlin: "fetched",
      }),
      null,
      2,
    ),
  );
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "live trial failed";
  console.error(JSON.stringify({ mode: "live-failed", message, credentialValuesRead: false }));
  process.exitCode = 1;
});
