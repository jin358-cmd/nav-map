import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { buildRoadEventCatalog } from "./catalog";
import { representativeLngLat } from "./geometry";
import {
  normalizeChiayiXml,
  normalizeNewTaipeiLive,
  normalizeTaichung,
  normalizeTaipeiToday,
} from "./normalize-open-data";
import { extractLiveEvents, normalizeTdxLivePayload } from "./normalize-tdx";
import { fetchTdxLiveSources, resetTdxFetchState } from "./tdx-http";
import { twd97Tm2ToWgs84 } from "./twd97";
import { parseWkt } from "./wkt";

const TODAY = "2026-10-30";
const tainan = JSON.parse(
  readFileSync("fixtures/tdx/live-events/tainan.json", "utf8"),
) as { UpdateTime: string; LiveEvents: Record<string, unknown>[] };

function near(actual: number, expected: number, tolerance = 1e-5) {
  assert.ok(Math.abs(actual - expected) < tolerance, `${actual} vs ${expected}`);
}

function testTwd97MatchesEpsg3826() {
  const taipei = twd97Tm2ToWgs84(309050.617, 2770535.957);
  assert.ok(taipei);
  near(taipei[0], 121.58519874);
  near(taipei[1], 25.04180803);
  const chiayi = twd97Tm2ToWgs84(197593.988726882, 2597737.43635438);
  assert.ok(chiayi);
  near(chiayi[0], 120.48694856);
  near(chiayi[1], 23.48187278);
  const banqiao = twd97Tm2ToWgs84(296820.605948587, 2769368.09349537);
  assert.ok(banqiao);
  near(banqiao[0], 121.46396174);
  near(banqiao[1], 25.03169243);
}

function testWktShapes() {
  const point = parseWkt("POINT (120.27644 23.14991)");
  assert.deepEqual(point, { type: "Point", coordinates: [120.27644, 23.14991] });
  assert.equal(parseWkt("POINT(121.5 25.0)")?.type, "Point");
  const line = parseWkt(
    "LINESTRING (120.25299 23.01964, 120.25309 23.01960, 120.25299 23.01964)",
  );
  assert.equal(line?.type, "LineString");
  const polygon = parseWkt(
    "POLYGON (( 120.711173991 24.207147048, 120.71115902 24.206898535, 120.711416522 24.206603595, 120.711173991 24.207147048))",
  );
  assert.equal(polygon?.type, "Polygon");
  if (polygon?.type === "Polygon") assert.equal(polygon.coordinates[0].length, 4);
  assert.equal(parseWkt("NOT WKT"), null);
}

function testTainanLiveFixture() {
  assert.equal(extractLiveEvents({ Events: [{ EventID: "x" }], value: [{ EventID: "y" }] }).rows.length, 0);
  const ignored = normalizeTdxLivePayload(
    { UpdateTime: tainan.UpdateTime, Events: tainan.LiveEvents, LiveEvents: tainan.LiveEvents },
    { id: "tdx:City:Tainan", city: "tainan", label: "TDX 臺南市" },
  );
  assert.equal(ignored.rawCount, 89);
  assert.equal(ignored.uniqueCount, 89);
  assert.equal(ignored.updateTime, "2026-10-30T09:22:04+08:00");
  assert.equal(ignored.byEventType["1"], 8);
  assert.equal(ignored.byEventType["2"], 45);
  assert.equal(ignored.byEventType["3"], 36);
  assert.equal(ignored.withCoordinates, 89);
  const accident = ignored.events.find((event) => event.eventType === "accident");
  const construction = ignored.events.find((event) => event.eventType === "construction");
  assert.equal(accident?.locationPrecision, "point");
  assert.equal(construction?.locationPrecision, "line");
  assert.equal(construction?.source, "臺南市工務局");
  assert.equal(accident?.sourceUpdateTime, ignored.updateTime);
  assert.ok(construction?.road);
}

function testOpenDataFixtures() {
  const taipei = normalizeTaipeiToday(
    JSON.parse(readFileSync("fixtures/open-construction/taipei-today.sample.json", "utf8")),
    { today: TODAY, updateTime: null },
  );
  assert.equal(taipei.rawCount, 1);
  assert.equal(taipei.activeCount, 1);
  assert.equal(taipei.events[0].locationPrecision, "area");
  assert.equal(taipei.events[0].city, "taipei");
  assert.equal(taipei.events[0].severity, "未阻斷");
  const point = representativeLngLat(taipei.events[0].geometry);
  assert.ok(point);
  assert.ok(point[0] > 121.5 && point[0] < 121.6);
  assert.ok(point[1] > 25.0 && point[1] < 25.1);

  const taichung = normalizeTaichung(
    JSON.parse(readFileSync("fixtures/open-construction/taichung.sample.json", "utf8")),
    { today: TODAY, updateTime: null },
  );
  assert.equal(taichung.activeCount, 1);
  assert.equal(taichung.events[0].locationPrecision, "area");
  assert.equal(taichung.events[0].city, "taichung");

  const ntpc = normalizeNewTaipeiLive(
    readFileSync("fixtures/open-construction/newtaipei-live.sample.csv", "utf8"),
    { today: TODAY, updateTime: null },
  );
  assert.equal(ntpc.rawCount, 2);
  assert.equal(ntpc.activeCount, 2);
  assert.ok(ntpc.events.every((event) => event.locationPrecision === "area"));
  assert.ok(ntpc.updateTime?.startsWith("2026-10-30"));

  const chiayi = normalizeChiayiXml(
    readFileSync("fixtures/open-construction/chiayi.sample.xml", "utf8"),
    { today: TODAY, updateTime: null },
  );
  assert.equal(chiayi.rawCount, 1);
  assert.equal(chiayi.activeCount, 1);
  assert.equal(chiayi.events[0].locationPrecision, "area");
  const chiayiPoint = representativeLngLat(chiayi.events[0].geometry);
  assert.ok(chiayiPoint);
  near(chiayiPoint[0], 120.48694856, 1e-3);
  near(chiayiPoint[1], 23.48187278, 1e-3);
}

function testDedupeTaipeiOverlap() {
  const open = normalizeTaipeiToday(
    JSON.parse(readFileSync("fixtures/open-construction/taipei-today.sample.json", "utf8")),
    { today: TODAY, updateTime: null },
  );
  const origin = representativeLngLat(open.events[0].geometry);
  assert.ok(origin);
  const tdx = normalizeTdxLivePayload(
    {
      UpdateTime: "2026-10-30T21:00:00+08:00",
      LiveEvents: [
        {
          EventID: "tdx-taipei-1",
          EventType: 2,
          EventTitle: "施工",
          Description: "核備 11300943-7",
          Positions: `POINT (${origin[0]} ${origin[1]})`,
          Source: "臺北市交通管制工程處",
        },
      ],
    },
    { id: "tdx:City:Taipei", city: "taipei", label: "TDX 臺北市" },
  );
  const catalog = buildRoadEventCatalog([
    { ...tdx, events: tdx.events },
    open,
  ]);
  assert.equal(catalog.dedupedCount, 1);
  assert.equal(catalog.events.length, 1);
  assert.equal(catalog.events[0].locationPrecision, "area");
  assert.equal(catalog.events[0].dedupedWith.length, 1);

  const distant = normalizeTdxLivePayload(
    {
      UpdateTime: "2026-10-30T21:00:00+08:00",
      LiveEvents: [
        {
          EventID: "other-city",
          EventType: 2,
          Positions: "POINT (120.2 23.0)",
          Source: "臺南市工務局",
        },
      ],
    },
    { id: "tdx:City:Tainan", city: "tainan", label: "TDX 臺南市" },
  );
  const kept = buildRoadEventCatalog([distant, open]);
  assert.equal(kept.dedupedCount, 0);
  assert.equal(kept.events.length, 2);
}

async function testPerSourceFailureAndPagination() {
  resetTdxFetchState();
  let tokenCalls = 0;
  const fetchImpl: typeof fetch = async (input) => {
    const url = new URL(String(input));
    if (url.pathname.includes("/token")) {
      tokenCalls += 1;
      return new Response(JSON.stringify({ access_token: "token", expires_in: 3600 }), {
        status: 200,
      });
    }
    if (url.pathname.includes("Tainan")) {
      return new Response("missing", { status: 404 });
    }
    const skip = Number(url.searchParams.get("$skip") ?? "0");
    const live =
      skip === 0
        ? [
            { EventID: "a", EventType: 1, Positions: "POINT (121.5 25.0)" },
            { EventID: "a", EventType: 1, Positions: "POINT (121.5 25.0)" },
          ]
        : [{ EventID: "b", EventType: 2, Geometry: "LINESTRING (121.5 25.0, 121.51 25.01)" }];
    return new Response(JSON.stringify({ UpdateTime: "2026-10-30T21:00:00+08:00", LiveEvents: live }), {
      status: 200,
    });
  };
  const results = await fetchTdxLiveSources({
    credentials: { clientId: "id", clientSecret: "secret" },
    sources: [
      { id: "tdx:City:Tainan", path: "/v1/Traffic/RoadEvent/LiveEvent/City/Tainan", city: "tainan", label: "臺南" },
      { id: "tdx:City:Taipei", path: "/v1/Traffic/RoadEvent/LiveEvent/City/Taipei", city: "taipei", label: "臺北" },
    ],
    pageSize: 2,
    minGapMs: 0,
    fetchImpl,
    sleep: async () => {},
  });
  assert.equal(tokenCalls, 1);
  assert.equal(results[0].ok, false);
  assert.equal(results[0].httpStatus, 404);
  assert.equal(results[1].ok, true);
  assert.equal(results[1].rawCount, 3);
  assert.equal(results[1].uniqueCount, 2);
  assert.equal(results[1].calls, 2);
  assert.equal(results[1].byEventType["1"], 1);
  assert.equal(results[1].byEventType["2"], 1);
  const catalog = buildRoadEventCatalog(results);
  assert.equal(catalog.events.length, 2);
}

async function main() {
  testTwd97MatchesEpsg3826();
  testWktShapes();
  testTainanLiveFixture();
  testOpenDataFixtures();
  testDedupeTaipeiOverlap();
  await testPerSourceFailureAndPagination();
  console.log(JSON.stringify({ ok: true, suite: "road-events" }));
}

main();
