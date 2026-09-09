#!/usr/bin/env node
import { classifyMatchQuality, nlscQuery, normalizeDoorAddress } from "./gcis-address.mjs";
import { brandFields } from "./gcis-brands.mjs";
import {
  beginJob,
  emptyCheckpoint,
  sliceUnmatchedQueue,
} from "./gcis-checkpoint.mjs";
import { isNavReady, navEligibilityScore, suggestEligible } from "./gcis-score.mjs";

function assert(cond, message) {
  if (!cond) throw new Error(message);
}

const door = normalizeDoorAddress("臺南市 北區 海安路三段 500 巷 39 號 1 樓");
assert(door === "台南市北區海安路三段500巷39號", `normalize got ${door}`);
assert(
  nlscQuery("臺南市 北區 海安路三段 500 巷 39 號 1 樓") === "臺南市北區海安路三段500巷39號",
  "nlsc query",
);

const seven = brandFields("統一超商股份有限公司台南市第123分公司");
assert(seven.brand === "7-Eleven", "7-Eleven brand");
assert(Array.isArray(seven.aliases) && seven.aliases.includes("7-11"), "7-Eleven aliases");

const family = brandFields("全家便利商店股份有限公司台南金華分公司");
assert(family.brand === "FamilyMart", "FamilyMart");

assert(classifyMatchQuality("台南市北區海安路三段500巷39號", null) === "E", "E miss");
assert(
  classifyMatchQuality("台南市北區海安路三段500巷39號1樓", {
    lat: 22.99,
    lng: 120.2,
    kind: "ADDRESS",
    label: "臺南市北區海安路三段500巷39號",
  }) === "B",
  "B after floor strip",
);
assert(
  classifyMatchQuality("台南市北區海安路三段500巷39號", {
    lat: 22.99,
    lng: 120.2,
    kind: "ADDRESS",
    label: "臺南市北區海安路三段500巷39號",
  }) === "A",
  "A exact",
);
assert(
  classifyMatchQuality("台南市北區海安路三段", {
    lat: 22.99,
    lng: 120.2,
    kind: "CROSSROAD",
    label: "海安路三段",
  }) === "D",
  "D road center",
);

const high = navEligibilityScore({
  registryType: "business",
  address: "台南市北區海安路三段500巷39號1樓",
  matchQuality: "A",
  addressEntityCount: 1,
  brand: "FamilyMart",
  osmMatched: true,
  industry: "便利商店",
  mainCategory: "food",
  sourceUpdatedAt: "20260901000000",
  hasPhone: true,
});
assert(high >= 80, `high score ${high}`);

const office = navEligibilityScore({
  registryType: "company",
  address: "台北市信義區信義路五段7號55樓商務中心",
  matchQuality: "D",
  addressEntityCount: 80,
  industry: "公司登記",
  mainCategory: "housing",
});
assert(office < 40, `office score ${office}`);
assert(!suggestEligible("D", office), "D not suggestable");
assert(isNavReady("A", 80), "nav ready");
assert(!isNavReady("C", 80), "C not nav-ready");

const queue = Array.from({ length: 40 }, (_, i) => ({
  taxId: String(1000 + i).padStart(8, "0"),
}));
const job = beginJob(emptyCheckpoint(), "v1");
const first = sliceUnmatchedQueue(queue, job, 10);
assert(first.start_offset === 0 && first.batch.length === 10, "first batch");
const resumed = sliceUnmatchedQueue(
  queue,
  { ...job, last_successful_registry_id: first.batch[9].taxId, last_successful_offset: 10 },
  10,
);
assert(resumed.start_offset === 10, `resume start ${resumed.start_offset}`);
assert(resumed.queue_offset === 10, `queue offset ${resumed.queue_offset}`);
assert(resumed.batch[0].taxId === queue[10].taxId, "resume tax id");
const shrunk = queue.slice(10);
const resumedShrunk = sliceUnmatchedQueue(
  shrunk,
  { last_successful_registry_id: queue[9].taxId, last_successful_offset: 10 },
  10,
);
assert(resumedShrunk.batch[0].taxId === queue[10].taxId, "shrunk queue continues");
assert(resumedShrunk.start_offset === 10, "global offset kept");
assert(resumedShrunk.queue_offset === 0, "current queue already dropped done ids");

console.log("gcis-phase52-selftest ok");
