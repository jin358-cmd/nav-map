#!/usr/bin/env node
import assert from "node:assert/strict";
import {
  SOUTH_PILOT_SET,
  classifyRow,
  countyFromText,
  normalizeCounty,
} from "./south-poi-shared.mjs";

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

testCountyNormalize();
testDedupAndPublish();
testBoundsReject();
testPingdongNotConflict();
console.log(JSON.stringify({ ok: true, tests: 4 }));
