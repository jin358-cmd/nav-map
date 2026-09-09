#!/usr/bin/env node
/**
 * Reclassify existing GCIS rows after village-house / county-mismatch rules.
 * Does not call NLSC.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { gunzipSync, gzipSync } from "node:zlib";
import { classifyMatchQuality } from "./gcis-address.mjs";
import { navEligibilityScore } from "./gcis-score.mjs";

const GZ = "src/data/taiwan-poi-index.json.gz";
const rows = JSON.parse(gunzipSync(readFileSync(GZ)).toString("utf8"));
let toC = 0;
let toE = 0;
let unchanged = 0;

for (const row of rows) {
  if (row.source !== "gov") continue;
  const city = String(row.city || row.county || "");
  const offshore = city.includes("連江") || city.includes("金門") || city.includes("澎湖");
  const villageHouse = /[村里].*\d+號/.test(String(row.address || ""));
  if (!offshore && !(row.matchQuality === "D" && villageHouse)) {
    unchanged += 1;
    continue;
  }
  const kind = row.matchQuality === "A" || row.matchQuality === "B" ? "ADDRESS" : "CROSSROAD";
  const next = classifyMatchQuality(row.address, {
    lat: row.latitude,
    lng: row.longitude,
    kind,
    label: row.address,
  });
  if (!next || next === row.matchQuality) {
    unchanged += 1;
    continue;
  }
  const prev = row.matchQuality;
  row.matchQuality = next;
  row.navEligibilityScore = navEligibilityScore({
    registryType: row.registryType,
    address: row.address,
    matchQuality: next,
    addressEntityCount: row.addressEntityCount ?? 1,
    brand: row.brand,
    osmMatched: false,
    industry: row.industry || "",
    mainCategory: row.mainCategory,
    sourceUpdatedAt: row.sourceUpdatedAt,
    hasPhone: Boolean(row.phone),
  });
  if (next === "C" && prev === "D") toC += 1;
  else if (next === "E") toE += 1;
}

writeFileSync(GZ, gzipSync(JSON.stringify(rows)));
console.log(JSON.stringify({ toC, toE, unchanged }, null, 2));
