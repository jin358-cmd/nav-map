import assert from "node:assert/strict";
import {
  buildCatalog,
  degradeTdxStatus,
  gateCaseCatalog,
  officialSampleCatalog,
  officialSampleRaw,
  parseGeometry,
  structuralCatalog,
  tdxFetchPlan,
  tdxPayloadToRaw,
} from "../src/lib/roadwork/engine.mjs";
import {
  ROADWORK_VOICE_FORBIDDEN,
  VERIFIED_ROADWORK_VOICE,
  nextVoiceAlert,
  routeAvoidanceAuthorized,
} from "../src/lib/roadwork/proximity.mjs";

const NOW = "2026-10-28T04:00:00+08:00";
const structural = structuralCatalog(NOW);
const gates = gateCaseCatalog(NOW);

assert.equal(structural.counts.input, 11);
assert.equal(structural.counts.unique, 10);
assert.equal(structural.counts.mapVisible, 0);
assert.equal(structural.mapEvents.length, 0);
assert.ok(structural.notices.every((event) => event.geometry == null || event.map_visible === false));
assert.ok(structural.events.every((event) => event.voice_eligible === false));
assert.ok(structural.events.every((event) => event.closure_avoidance_eligible === false));
assert.equal(structural.closureAvoidanceEnabled, false);

const health = structural.events.find((event) => event.source_id === "handoff-tainan-health-3");
assert.ok(health);
assert.equal(health.road_name, "健康三街");
assert.equal(health.display_class, "stale_or_unknown");
assert.equal(health.map_visible, false);

const inWindow = structural.events.find((event) => event.source_id === "fixture-thb-09");
assert.equal(inWindow.display_class, "official_notice");
assert.equal(inWindow.closure_status, "claimed");
assert.equal(inWindow.map_visible, false);

const missingDates = structural.events.find((event) => event.source_id === "fixture-thb-08");
assert.equal(missingDates.display_class, "stale_or_unknown");

const byId = Object.fromEntries(gates.events.map((event) => [event.source_id, event]));
assert.equal(byId["gate-verified-active"].display_class, "verified_active");
assert.equal(byId["gate-verified-active"].map_visible, true);
assert.equal(byId["gate-expired"].display_class, "stale_or_unknown");
assert.equal(byId["gate-expired"].map_visible, false);
assert.equal(byId["gate-no-direction"].display_class, "official_notice");
assert.equal(byId["gate-no-direction"].map_visible, false);
assert.equal(byId["gate-closure"].display_class, "closure_verified");
assert.equal(byId["gate-closure"].closure_avoidance_eligible, true);
assert.equal(routeAvoidanceAuthorized(), false);
assert.equal(byId["gate-closure-no-geometry"].display_class, "official_notice");
assert.equal(byId["gate-closure-no-geometry"].map_visible, false);
assert.equal(byId["gate-outside-taiwan"].geometry, null);
assert.equal(byId["gate-outside-taiwan"].map_visible, false);
assert.equal(byId["gate-ambiguous-pair"].geometry, null);
assert.equal(parseGeometry("120.2,22.9"), null);
assert.equal(byId["gate-link-a"].related_ids.includes("AGENCY_B:gate-link-b"), true);
assert.equal(byId["gate-link-b"].related_ids.includes("AGENCY_A:gate-link-a"), true);
assert.equal(byId["gate-opposite"].related_ids.length, 0);
assert.equal(gates.events.filter((event) => event.source_id === "gate-link-a").length, 1);
assert.equal(byId["gate-link-a"].description.includes("較早"), false);

const near = nextVoiceAlert(gates.mapEvents, { lng: 120.2051, lat: 22.9881 }, new Set());
assert.equal(near, "GATE_FIXTURE:gate-verified-active");
const second = nextVoiceAlert(gates.mapEvents, { lng: 120.2051, lat: 22.9881 }, new Set([near]));
assert.equal(second, "GATE_FIXTURE:gate-closure");
const again = nextVoiceAlert(
  gates.mapEvents,
  { lng: 120.2051, lat: 22.9881 },
  new Set([near, second]),
);
assert.equal(again, null);
const repeat = nextVoiceAlert(gates.mapEvents, { lng: 120.2051, lat: 22.9881 }, new Set([near]));
assert.equal(repeat, second);
const far = nextVoiceAlert(gates.mapEvents, { lng: 120.3, lat: 23.1 }, new Set());
assert.equal(far, null);
const noticeVoice = nextVoiceAlert(structural.events, { lng: 120.205, lat: 22.988 }, new Set());
assert.equal(noticeVoice, null);

for (const phrase of ROADWORK_VOICE_FORBIDDEN) {
  assert.equal(VERIFIED_ROADWORK_VOICE.includes(phrase), false);
}

assert.deepEqual(tdxFetchPlan(false), { fetch: false, reason: "unconfigured" });
assert.equal(degradeTdxStatus(401), "unauthorized");
assert.equal(degradeTdxStatus(429), "rate_limited");
assert.equal(degradeTdxStatus(503), "upstream");
assert.equal(degradeTdxStatus(0, true), "timeout");

const tdx = buildCatalog(
  tdxPayloadToRaw([
    {
      EventID: "tdx-1",
      Description: "來源有座標但尚未複核",
      EffectiveTime: "2026-10-27T00:00:00+08:00",
      ExpireTime: "2026-10-29T00:00:00+08:00",
      Geometry: "POINT(120.205 22.988)",
      Location: { CityRoad: { Roadways: [{ Road: "測試路", Direction: "北向" }] } },
    },
  ]),
  NOW,
);
assert.equal(tdx.mapEvents.length, 0);
assert.equal(tdx.events[0].geometry_confidence, "reported");
assert.equal(tdx.events[0].display_class, "official_notice");

const empty = buildCatalog(tdxPayloadToRaw([]), NOW);
assert.equal(empty.counts.unique, 0);

const official = officialSampleCatalog(NOW);
const officialRaw = officialSampleRaw();
assert.equal(officialRaw.declaredCount, 11);
assert.equal(officialRaw.extractedOn, "2026-10-19");
assert.equal(official.counts.input, 11);
assert.equal(official.counts.unique, 11);
assert.equal(official.counts.mapVisible, 0);
assert.equal(official.mapEvents.length, 0);
assert.equal(official.events.filter((event) => event.source_agency === "交通部公路局").length, 10);
assert.equal(official.events.filter((event) => event.source_agency === "臺南市政府交通局").length, 1);
assert.ok(official.events.every((event) => event.geometry == null));
assert.ok(official.events.every((event) => event.geometry_confidence === "none"));
assert.ok(official.events.every((event) => event.map_visible === false));
assert.ok(official.events.every((event) => event.voice_eligible === false));
assert.ok(official.events.every((event) => event.closure_avoidance_eligible === false));
assert.ok(official.events.every((event) => event.display_class === "stale_or_unknown"));
assert.ok(official.events.every((event) => event.closure_status === "unknown"));
assert.ok(official.events.every((event) => event.related_ids.length === 0));
const tainan = official.events.find((event) => event.source_id === "TNN-20261016-SAMPLE-01");
assert.equal(tainan.road_name, "健康三街");
assert.equal(tainan.segment_text, "健康路三段至府平路口 · 臺南市安平區");
assert.equal(tainan.direction, null);
assert.equal(tainan.scheduled_start, "2026-10-22");
assert.equal(tainan.scheduled_end, null);
assert.equal(tainan.published_at, "2026-10-16");
assert.equal(
  tainan.source_url,
  "https://traffic.tainan.gov.tw/Announcement/trafficcontrol?PageType=1&id=e39820c7-087a-4227-879a-7706bc3b6192&pageIndex=1",
);
const highway = official.events.find((event) => event.source_id === "THB-20261019-SAMPLE-01");
assert.equal(highway.road_name, "台1線");
assert.equal(highway.direction, "雙向");
assert.equal(highway.affected_lane, "外側車道");
assert.equal(highway.scheduled_start, null);
assert.equal(highway.published_at, "2026-10-19");
assert.equal(official.events.filter((event) => event.road_name === "台21線").length, 5);

console.log("roadwork-selftest PASS");
console.log(
  JSON.stringify(
    {
      structural: structural.counts,
      gateMap: gates.counts.mapVisible,
      voice: VERIFIED_ROADWORK_VOICE,
    },
    null,
    2,
  ),
);
