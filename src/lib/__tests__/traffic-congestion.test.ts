import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  buildCountyTraffic,
  envelopesFromBundle,
  lineOverlapsBounds,
  readTdxEnvelope,
  trafficCacheDecision,
} from "@/lib/traffic-congestion";
import { liveTrafficCityAt, trafficCityBounds } from "@/lib/traffic-cities";
import { TRAFFIC_LIVE_CACHE_MS, TRAFFIC_MIN_REFRESH_MS } from "@/lib/traffic-constants";

const fixture = JSON.parse(
  readFileSync(join(process.cwd(), "fixtures/tdx/yunlin-traffic.json"), "utf8"),
) as {
  city: Parameters<typeof envelopesFromBundle>[0];
  highway: Parameters<typeof envelopesFromBundle>[0];
};

const built = buildCountyTraffic({
  city: "YunlinCounty",
  origin: "tdx-fixture",
  cityBundle: envelopesFromBundle(fixture.city),
  highwayBundle: envelopesFromBundle(fixture.highway),
  bounds: trafficCityBounds("YunlinCounty"),
});

function segment(id: string) {
  const found = built.segments.find((item) => item.id.endsWith(`:${id}`));
  assert.ok(found, `missing ${id}`);
  return found;
}

assert.equal(built.stats.cityLive, 11);
assert.equal(built.stats.highwayLive, 2);
assert.equal(built.stats.highwayInCounty, 1);
assert.equal(built.stats.sectionsFetched, 12);
assert.equal(built.stats.geometryMatched, 10);
assert.equal(built.stats.endpointFallback, 1);
assert.equal(built.stats.unmatchedGeometry, 1);
assert.equal(built.stats.green, 2);
assert.equal(built.stats.yellow, 2);
assert.equal(built.stats.red, 4);
assert.equal(built.stats.unknown, 3);
assert.equal(built.stats.sectionLinks, 3);
assert.equal(built.stats.definitionGroups, 3);
assert.equal(
  built.stats.green +
    built.stats.yellow +
    built.stats.red +
    built.stats.unknown +
    built.stats.unmatchedGeometry,
  built.stats.sectionsFetched,
);

assert.equal(segment("YL-GREEN").congestionBand, "green");
assert.equal(segment("YL-GREEN").travelTimeSec, 90);
assert.equal(segment("YL-GREEN").speedKmh, 48);
assert.equal(segment("YL-GREEN").name, "斗六市中山路");
assert.equal(segment("YL-YELLOW").congestionBand, "yellow");
assert.equal(segment("YL-RED3").congestionBand, "red");
assert.equal(segment("YL-RED3").level, "congested");
assert.equal(segment("YL-RED4").congestionBand, "red");
assert.equal(segment("YL-RED4").level, "severe");
assert.equal(segment("YL-CLOSED").congestionBand, "red");
assert.equal(segment("YL-CLOSED").level, "blocked");
assert.equal(segment("YL-CLOSED").speedKmh, undefined);
assert.equal(segment("YL-BAD").congestionBand, "unknown");
assert.equal(segment("YL-BAD").congestionLabel, "資料異常");
assert.equal(segment("YL-BAD").speedKmh, 55);
assert.equal(segment("YL-MISSING").congestionBand, "unknown");
assert.equal(segment("YL-ZERO").congestionBand, "unknown");
assert.equal(segment("YL-ZERO").congestionLabel, "未知");
assert.equal(segment("YL-ALT").congestionBand, "green");
assert.equal(segment("YL-ALT").congestionLabel, "順暢");
assert.equal(segment("YL-ENDS").congestionBand, "yellow");
assert.equal(segment("YL-ENDS").coordinates.length, 2);
assert.equal(segment("HW-YUN").sourceType, "highway");
assert.equal(segment("HW-YUN").congestionBand, "red");
assert.equal(
  built.segments.some((item) => item.id.includes("HW-NORTH")),
  false,
);

const legacy = readTdxEnvelope<{ SectionID: string }>(
  { LiveTraffics: [{ SectionID: "A" }], AuthorityCode: "TNN" },
  ["LiveTraffics"],
);
assert.equal(legacy.authorityCode, "TNN");
assert.equal(legacy.items.length, 1);

assert.equal(liveTrafficCityAt({ lng: 120.54, lat: 23.71 }), "YunlinCounty");
assert.equal(liveTrafficCityAt({ lng: 120.2, lat: 22.99 }), "Tainan");
assert.equal(liveTrafficCityAt({ lng: 120.96, lat: 23.7 }), null);
assert.equal(
  lineOverlapsBounds(
    [
      [121.5, 25.03],
      [121.55, 25.08],
    ],
    trafficCityBounds("YunlinCounty")!,
  ),
  false,
);

assert.equal(TRAFFIC_LIVE_CACHE_MS, 60_000);
assert.equal(
  trafficCacheDecision(1_000, TRAFFIC_LIVE_CACHE_MS, false, TRAFFIC_MIN_REFRESH_MS),
  "hit",
);
assert.equal(
  trafficCacheDecision(61_000, TRAFFIC_LIVE_CACHE_MS, false, TRAFFIC_MIN_REFRESH_MS),
  "miss",
);
assert.equal(
  trafficCacheDecision(1_000, TRAFFIC_LIVE_CACHE_MS, true, TRAFFIC_MIN_REFRESH_MS),
  "hit",
);
assert.equal(
  trafficCacheDecision(20_000, TRAFFIC_LIVE_CACHE_MS, true, TRAFFIC_MIN_REFRESH_MS),
  "miss",
);

const hook = readFileSync(join(process.cwd(), "src/hooks/use-traffic-view.ts"), "utf8");
assert.equal(hook.includes("tdx.transportdata.tw"), false);
assert.equal(hook.includes("/api/traffic?"), true);
