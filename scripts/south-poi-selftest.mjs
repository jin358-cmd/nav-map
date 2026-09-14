#!/usr/bin/env node
import assert from "node:assert/strict";
import {
  SOUTH_PILOT_SET,
  classifyRow,
  countyFromText,
  normalizeCounty,
  parseCountyList,
  toSupabasePoiRow,
} from "./south-poi-shared.mjs";
import { applyBlockedReason, readSupabaseConfig } from "./supabase-navpilot.mjs";

function testCountyNormalize() {
  assert.equal(normalizeCounty("台南市"), "臺南市");
  assert.equal(normalizeCounty("臺南市"), "臺南市");
  assert.equal(countyFromText("高雄市前鎮區"), "高雄市");
  assert.ok(SOUTH_PILOT_SET.has("嘉義市"));
  assert.equal(SOUTH_PILOT_SET.has("臺北市"), false);
}

function testDedupAndPublish() {
  const a = classifyRow({
    id: "gov-1",
    name: "統一超商 中正門市",
    source: "gov",
    sourceId: "1",
    category: "convenience",
    address: "臺南市中西區中正路1號",
    county: "台南市",
    latitude: 22.9908,
    longitude: 120.2028,
    matchQuality: "A",
    navEligibilityScore: 82,
    isActive: true,
  });
  assert.equal(a.county, "臺南市");
  assert.equal(a.navReady, true);
  assert.equal(a.publishStatus, "published");

  const review = classifyRow({
    id: "gov-2",
    name: "診所",
    source: "gov",
    sourceId: "2",
    category: "clinic",
    address: "雲林縣",
    county: "雲林縣",
    latitude: 23.7,
    longitude: 120.43,
    matchQuality: "B",
    navEligibilityScore: 70,
    isActive: true,
  });
  assert.equal(review.publishStatus, "review");

  const outside = classifyRow({
    id: "gov-3",
    name: "台北店",
    source: "gov",
    sourceId: "3",
    category: "convenience",
    address: "臺北市中正區",
    county: "臺北市",
    latitude: 25.04,
    longitude: 121.51,
    matchQuality: "A",
    navEligibilityScore: 90,
    isActive: true,
  });
  assert.equal(outside.publishStatus, "reject");
  assert.ok(outside.reasons.includes("outside_south_pilot"));
}

function testPingdongNotConflict() {
  const row = classifyRow({
    id: "gov-5",
    name: "屏東超商",
    source: "gov",
    sourceId: "5",
    category: "convenience",
    address: "屏東縣潮州鎮",
    county: "屏東縣",
    latitude: 22.55,
    longitude: 120.54,
    matchQuality: "A",
    navEligibilityScore: 80,
    isActive: true,
  });
  assert.equal(row.publishStatus, "published");
  assert.equal(row.reasons.includes("county_geom_conflict"), false);
}

function testBoundsReject() {
  const bad = classifyRow({
    id: "gov-4",
    name: "異常點",
    source: "gov",
    sourceId: "4",
    category: "convenience",
    address: "臺南市",
    county: "臺南市",
    latitude: 0,
    longitude: 0,
    matchQuality: "A",
    navEligibilityScore: 90,
    isActive: true,
  });
  assert.equal(bad.publishStatus, "reject");
}

function testSupabaseRowAndCounties() {
  const classified = classifyRow({
    id: "gov-6",
    name: "統一超商 成功門市",
    source: "gov",
    sourceId: "6",
    category: "convenience",
    address: "高雄市新興區",
    county: "高雄市",
    latitude: 22.631,
    longitude: 120.302,
    matchQuality: "A",
    navEligibilityScore: 88,
    isActive: true,
  });
  const db = toSupabasePoiRow(classified, "2026-09-14T00:00:00.000Z");
  assert.equal(db.county, "高雄市");
  assert.equal(db.main_category, "food");
  assert.equal(db.category, "convenience");
  assert.equal(db.publish_status, "published");
  assert.equal(db.nav_ready, true);
  assert.match(db.geom, /^SRID=4326;POINT\(/);
  const yunlin = parseCountyList("台南市,雲林縣");
  assert.deepEqual(yunlin.selected, ["雲林縣", "臺南市"]);
  const bad = parseCountyList("臺北市");
  assert.deepEqual(bad.selected, []);
  assert.deepEqual(bad.unknown, ["臺北市"]);
}

function testForbiddenProject() {
  const prev = {
    url: process.env.SUPABASE_URL,
    key: process.env.SUPABASE_SERVICE_ROLE_KEY,
    ref: process.env.NAVPILOT_SUPABASE_PROJECT_REF,
  };
  process.env.SUPABASE_URL = "https://gvg-prod.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "secret-test-key";
  delete process.env.NAVPILOT_SUPABASE_PROJECT_REF;
  const config = readSupabaseConfig();
  assert.equal(config.ok, false);
  assert.equal(config.reason, "forbidden_project");
  process.env.SUPABASE_URL = "https://abcdefghijklmnop.supabase.co";
  const unconfirmed = readSupabaseConfig();
  assert.equal(unconfirmed.ok, true);
  assert.equal(applyBlockedReason(unconfirmed), "project_ref_unconfirmed");
  process.env.NAVPILOT_SUPABASE_PROJECT_REF = "abcdefghijklmnop";
  assert.equal(applyBlockedReason(readSupabaseConfig()), null);
  if (prev.url == null) delete process.env.SUPABASE_URL;
  else process.env.SUPABASE_URL = prev.url;
  if (prev.key == null) delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  else process.env.SUPABASE_SERVICE_ROLE_KEY = prev.key;
  if (prev.ref == null) delete process.env.NAVPILOT_SUPABASE_PROJECT_REF;
  else process.env.NAVPILOT_SUPABASE_PROJECT_REF = prev.ref;
}

testCountyNormalize();
testDedupAndPublish();
testBoundsReject();
testPingdongNotConflict();
testSupabaseRowAndCounties();
testForbiddenProject();
console.log(JSON.stringify({ ok: true, tests: 6 }));
