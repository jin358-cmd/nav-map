#!/usr/bin/env node
/**
 * Local address-index advisor. Does not call Supabase advisors.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";

const INDEX =
  process.env.SOUTH_ADDRESS_INDEX ||
  (existsSync("src/data/south-address-index.json.gz")
    ? "src/data/south-address-index.json.gz"
    : "data/south-pilot/address-index.json.gz");
const BOXES = "src/data/taiwan-admin-boxes.json";
const OUT = "docs/phase-5-3a-address-advisor.json";

function loadIndex() {
  if (!existsSync(INDEX)) return null;
  return JSON.parse(gunzipSync(readFileSync(INDEX)).toString("utf8"));
}

function inBox(lat, lng, box) {
  return lat >= box.south && lat <= box.north && lng >= box.west && lng <= box.east;
}

function main() {
  const supabase = Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
  const payload = loadIndex();
  const boxes = existsSync(BOXES) ? JSON.parse(readFileSync(BOXES, "utf8")) : { counties: {}, districts: {} };
  if (!payload) {
    const report = {
      mode: "local",
      supabaseAdvisors: "skipped",
      reason: "missing_local_index",
      hint: "node scripts/build-south-address-index.mjs",
    };
    writeFileSync(OUT, `${JSON.stringify(report, null, 2)}\n`);
    console.log(JSON.stringify(report, null, 2));
    return;
  }

  let mismatch = 0;
  let ok = 0;
  let noCounty = 0;
  const byAccuracy = {};
  for (const row of payload.rows || []) {
    byAccuracy[row.a] = (byAccuracy[row.a] || 0) + 1;
    const box = boxes.counties[row.c];
    if (!box) {
      noCounty += 1;
      continue;
    }
    if (inBox(row.lat, row.lng, box)) ok += 1;
    else mismatch += 1;
  }

  const rowCount = Array.isArray(payload.rows) ? payload.rows.length : payload.count;
  const report = {
    mode: "local",
    supabaseAdvisors: supabase ? "blocked_until_project_confirmed" : "not_configured",
    wroteSupabase: false,
    index: INDEX,
    source: payload.source,
    notOfficialCountyFile: payload.notOfficialCountyFile,
    rows: rowCount,
    mergedRetryNav: payload.mergedRetryNav ?? 0,
    regionValidation: { ok, mismatch, noCounty },
    byAccuracy,
    districtBoxes: Object.values(boxes.districts || {}).reduce((n, group) => n + Object.keys(group).length, 0),
    countyBoxes: Object.keys(boxes.counties || {}).length,
    flags: [
      mismatch > 0 ? `${mismatch} 筆座標落在宣告縣市包箱外（仍保留，不刪列）` : "縣市包箱內",
      payload.mergedRetryNav
        ? `含後續重試併入 ${payload.mergedRetryNav} 筆，與 manifest uniqueAddresses 對齊`
        : "官方多邊形未提供，district 包箱不得當成界線驗證完成",
      "官方多邊形未提供，district 包箱不得當成界線驗證完成",
      "nlsc-derived 不是縣市官方門牌原始檔",
    ],
  };
  writeFileSync(OUT, `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify(report, null, 2));
}

main();
