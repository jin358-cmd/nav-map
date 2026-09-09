#!/usr/bin/env node
/** Summarize gov POIs in the navigation index for Phase 5.2 coverage. */
import { readFileSync, writeFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { COUNTIES } from "./gcis-address.mjs";
import { isNavReady } from "./gcis-score.mjs";

const rows = JSON.parse(gunzipSync(readFileSync("src/data/taiwan-poi-index.json.gz")).toString("utf8"));
const gov = rows.filter((row) => row.source === "gov");
const active = gov.filter((row) => row.isActive !== false);
const byCounty = Object.fromEntries(
  COUNTIES.map((city) => [city, { matched: 0, navReady: 0, active: 0, avgScore: 0, _s: 0 }]),
);
const byMain = {};
let scoreSum = 0;
const quality = { A: 0, B: 0, C: 0, D: 0, E: 0 };
let company = 0;
let business = 0;
let cluster = 0;
let brandN = 0;
let phoneN = 0;
const samples = {};

for (const row of gov) {
  const city = row.city || "未知";
  if (!byCounty[city]) byCounty[city] = { matched: 0, navReady: 0, active: 0, avgScore: 0, _s: 0 };
  const nav = isNavReady(row.matchQuality || "B", row.navEligibilityScore ?? 0) && row.isActive !== false;
  if (row.isActive !== false) {
    byCounty[city].matched += 1;
    byCounty[city].active += 1;
    byCounty[city]._s += row.navEligibilityScore || 0;
    if (nav) byCounty[city].navReady += 1;
  }
  const layer = row.mainCategory || "other";
  if (!byMain[layer]) {
    byMain[layer] = { matched: 0, navReady: 0, active: 0, avgScore: 0, _s: 0 };
  }
  if (row.isActive !== false) {
    byMain[layer].matched += 1;
    byMain[layer].active += 1;
    byMain[layer]._s += row.navEligibilityScore || 0;
    if (nav) byMain[layer].navReady += 1;
  }
  quality[row.matchQuality || "?"] = (quality[row.matchQuality || "?"] ?? 0) + 1;
  if (row.registryType === "business") business += 1;
  else company += 1;
  if ((row.addressEntityCount ?? 1) >= 20) cluster += 1;
  if (row.brand) brandN += 1;
  if (row.phone) phoneN += 1;
  if (typeof row.navEligibilityScore === "number") scoreSum += row.navEligibilityScore;

  const cat = row.category || "other";
  if (!samples[cat]) samples[cat] = [];
  if (samples[cat].length < 20 && nav) {
    const addrCity = String(row.address || "").match(/(臺北市|台北市|新北市|桃園市|臺中市|台中市|臺南市|台南市|高雄市|基隆市|新竹市|新竹縣|苗栗縣|彰化縣|南投縣|雲林縣|嘉義市|嘉義縣|屏東縣|宜蘭縣|花蓮縣|臺東縣|台東縣|澎湖縣|金門縣|連江縣)/)?.[1];
    const cityOk = !addrCity || String(row.city || "").replaceAll("台", "臺") === String(addrCity).replaceAll("台", "臺");
    const inTw = row.longitude > 118 && row.longitude < 123 && row.latitude > 20 && row.latitude < 27;
    samples[cat].push({
      name: row.name,
      address: row.address,
      lat: row.latitude,
      lng: row.longitude,
      quality: row.matchQuality,
      score: row.navEligibilityScore,
      cityOk,
      inTw,
      registryType: row.registryType,
    });
  }
}

for (const row of Object.values(byCounty)) {
  row.avgScore = row.matched ? Number((row._s / row.matched).toFixed(2)) : 0;
  delete row._s;
}
for (const row of Object.values(byMain)) {
  row.avgScore = row.matched ? Number((row._s / row.matched).toFixed(2)) : 0;
  delete row._s;
}

const sampleFlags = Object.fromEntries(
  Object.entries(samples).map(([cat, list]) => [
    cat,
    {
      n: list.length,
      cityMismatch: list.filter((item) => !item.cityOk).length,
      outOfTaiwan: list.filter((item) => !item.inTw).length,
    },
  ]),
);

const out = {
  totalIndex: rows.length,
  gov: gov.length,
  govActive: active.length,
  navReady: active.filter((row) => isNavReady(row.matchQuality || "B", row.navEligibilityScore ?? 0)).length,
  avgNavEligibilityScore: gov.length ? Number((scoreSum / gov.length).toFixed(2)) : 0,
  registryMix: { company, business },
  matchQuality: quality,
  clusterDownranked: cluster,
  withBrand: brandN,
  withPhone: phoneN,
  byCounty,
  byMainCategory: byMain,
  navSampleFlags: sampleFlags,
};
writeFileSync("docs/gcis-coverage.json", `${JSON.stringify(out, null, 2)}\n`);
writeFileSync("docs/gcis-nav-sample.json", `${JSON.stringify(samples, null, 2)}\n`);
console.log(JSON.stringify({ gov: out.gov, navReady: out.navReady, avg: out.avgNavEligibilityScore, mix: out.registryMix }, null, 2));
