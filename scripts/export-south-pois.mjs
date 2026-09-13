#!/usr/bin/env node
/**
 * Dry-run / export southern POIs. Never writes to Supabase.
 * Usage: node scripts/export-south-pois.mjs
 */

import { createHash } from "node:crypto";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  DATA_VERSION,
  EXPECTED,
  SOUTH_PILOT_REGIONS,
  SOUTH_PILOT_SET,
  classifyRow,
  loadPoiRows,
  sha256File,
} from "./south-poi-shared.mjs";

const INDEX =
  process.env.NAVPILOT_POI_INDEX ||
  (existsSync("src/data/taiwan-poi-index.json.gz")
    ? "src/data/taiwan-poi-index.json.gz"
    : "/tmp/phase53a-src/taiwan-poi-index.json.gz");

const OUT_DIR = "data/south-pilot";
const DOCS = "docs/phase-5-3a-south-poi-dry-run.json";

function bump(map, key) {
  map[key] = (map[key] || 0) + 1;
}

function emptyCounty() {
  return {
    candidates: 0,
    located: 0,
    gcisNavReady: 0,
    navReady: 0,
    review: 0,
    reject: 0,
    published: 0,
  };
}

function main() {
  if (!existsSync(INDEX)) {
    console.error(
      JSON.stringify({
        stop: true,
        reason: "missing_source_index",
        expected: "805419-row taiwan-poi-index.json.gz",
        looked: INDEX,
      }),
    );
    process.exit(2);
  }

  const sourceHash = sha256File(INDEX);
  const rows = loadPoiRows(INDEX);
  if (rows.length < 200_000) {
    console.error(
      JSON.stringify({
        stop: true,
        reason: "index_too_small",
        count: rows.length,
        expectedAtLeast: 805_419,
      }),
    );
    process.exit(2);
  }

  const byCounty = Object.fromEntries(SOUTH_PILOT_REGIONS.map((name) => [name, emptyCounty()]));
  const byCategory = {};
  const byQuality = { A: 0, B: 0, C: 0, D: 0, E: 0, none: 0 };
  const seen = new Set();
  const published = [];
  const review = [];
  const rejects = [];
  let dup = 0;
  let cluster = 0;
  let countyConflict = 0;
  let coordBad = 0;
  let outside = 0;
  const clusterKeys = new Map();
  const reviewReasons = {};
  const chiayiYunlinReasons = { 雲林縣: {}, 嘉義縣: {} };

  for (const raw of rows) {
    const city = raw.county || raw.city || "";
    const classified = classifyRow(raw);
    const key = `${classified.source}:${classified.sourceId}`;
    if (seen.has(key)) {
      dup += 1;
      continue;
    }
    seen.add(key);

    const inSouth = SOUTH_PILOT_SET.has(classified.county);
    if (!inSouth) {
      if (SOUTH_PILOT_SET.has(String(city).replaceAll("台", "臺"))) {
        outside += 1;
        rejects.push({
          source: classified.source,
          sourceId: classified.sourceId,
          reason: classified.reasons.join(",") || "outside_south_pilot",
        });
      }
      continue;
    }

    const bucket = byCounty[classified.county] || emptyCounty();
    if (!byCounty[classified.county]) byCounty[classified.county] = bucket;
    bucket.candidates += 1;
    bump(byCategory, classified.category);
    const q = classified.qualityGrade || "none";
    byQuality[q] = (byQuality[q] || 0) + 1;

    if (classified.reasons.includes("county_geom_conflict")) countyConflict += 1;
    if (classified.reasons.includes("coords_out_of_taiwan")) coordBad += 1;

    if (classified.located) bucket.located += 1;
    if (classified.gcisNavReady) bucket.gcisNavReady += 1;

    if (classified.publishStatus === "published") {
      bucket.navReady += 1;
      bucket.published += 1;
      published.push(classified);
    } else if (classified.publishStatus === "review") {
      bucket.review += 1;
      review.push(classified);
      for (const reason of classified.reasons.length ? classified.reasons : ["below_nav_threshold"]) {
        bump(reviewReasons, reason);
        if (chiayiYunlinReasons[classified.county]) {
          bump(chiayiYunlinReasons[classified.county], reason);
        }
      }
    } else {
      bucket.reject += 1;
      rejects.push({
        source: classified.source,
        sourceId: classified.sourceId,
        reason: classified.reasons.join(",") || "reject",
      });
    }

    if (Number.isFinite(classified.latitude) && Number.isFinite(classified.longitude)) {
      const ck = `${classified.longitude.toFixed(5)},${classified.latitude.toFixed(5)}`;
      clusterKeys.set(ck, (clusterKeys.get(ck) || 0) + 1);
    }
  }

  for (const count of clusterKeys.values()) {
    if (count >= 8) cluster += 1;
  }

  const totals = SOUTH_PILOT_REGIONS.reduce(
    (acc, name) => {
      const row = byCounty[name];
      acc.candidates += row.candidates;
      acc.located += row.located;
      acc.gcisNavReady += row.gcisNavReady;
      acc.navReady += row.navReady;
      acc.review += row.review;
      acc.reject += row.reject;
      acc.published += row.published;
      return acc;
    },
    { candidates: 0, located: 0, gcisNavReady: 0, navReady: 0, review: 0, reject: 0, published: 0 },
  );

  const chiayi = {
    candidates: (byCounty["嘉義市"]?.candidates || 0) + (byCounty["嘉義縣"]?.candidates || 0),
    located: (byCounty["嘉義市"]?.located || 0) + (byCounty["嘉義縣"]?.located || 0),
    gcisNavReady: (byCounty["嘉義市"]?.gcisNavReady || 0) + (byCounty["嘉義縣"]?.gcisNavReady || 0),
    published: (byCounty["嘉義市"]?.published || 0) + (byCounty["嘉義縣"]?.published || 0),
  };

  const diffs = {
    candidates: totals.candidates - EXPECTED.candidates,
    located: totals.located - EXPECTED.located,
    gcisNavReady: totals.gcisNavReady - EXPECTED.navReady,
    published: totals.published - EXPECTED.navReady,
    unmatched: totals.reject - EXPECTED.unmatched,
    review: totals.review - EXPECTED.review,
  };

  mkdirSync(OUT_DIR, { recursive: true });
  mkdirSync("docs", { recursive: true });

  const payload = {
    dataVersion: DATA_VERSION,
    generatedAt: new Date().toISOString(),
    sourceFile: INDEX,
    sourceCount: rows.length,
    sourceSha256: sourceHash,
    checkpoint: "completed",
    regions: SOUTH_PILOT_REGIONS,
    expected: EXPECTED,
    actual: totals,
    diffs,
    byCounty,
    chiayiCombined: chiayi,
    byCategory,
    byQuality,
    reviewReasons,
    chiayiYunlinReviewReasons: chiayiYunlinReasons,
    duplicateSourceId: dup,
    countyGeomConflicts: countyConflict,
    coordAnomalies: coordBad,
    sameCoordClusters: cluster,
    outsideSouthNormalized: outside,
    estimatedUpsertBatches: Math.ceil((totals.located || 1) / 3000),
    notes: [
      "GCIS 南部候選 226,721 = 已配對 206,952 + 未定位 19,769。未定位不在索引內，故 index reject≈0。",
      "索引南部列 − GCIS 已配對 ≈ OSM／連鎖等非 GCIS 列，故 candidates／located 會高於純 GCIS 基準。",
      "gcisNavReady 沿用 A/B 且分數≥60，不放寬。published 再扣除籠統店名、僅縣市地址、明顯縣市衝突、無法分類生活。",
      "台／臺 已正規化；區域外不得 published。",
    ],
  };

  writeFileSync(DOCS, `${JSON.stringify(payload, null, 2)}\n`);
  writeFileSync(
    join(OUT_DIR, "summary.json"),
    `${JSON.stringify(payload, null, 2)}\n`,
  );
  writeFileSync(
    join(OUT_DIR, "rejects.json"),
    `${JSON.stringify({ count: rejects.length, sample: rejects.slice(0, 200) }, null, 2)}\n`,
  );

  const publishedHash = createHash("sha256")
    .update(published.map((row) => row.id).sort().join("\n"))
    .digest("hex");
  writeFileSync(
    join(OUT_DIR, "data-version.json"),
    `${JSON.stringify(
      {
        version: DATA_VERSION,
        published: published.length,
        review: review.length,
        reject: rejects.length,
        publishedIdHash: publishedHash,
        sourceSha256: sourceHash,
      },
      null,
      2,
    )}\n`,
  );

  const blocking = [];
  if (dup > 0) blocking.push(`duplicate_source_id=${dup}`);
  if (totals.published && !SOUTH_PILOT_REGIONS.every((name) => byCounty[name])) {
    blocking.push("missing_county_bucket");
  }

  console.log(
    JSON.stringify(
      {
        ok: blocking.length === 0,
        blocking,
        dataVersion: DATA_VERSION,
        sourceCount: rows.length,
        ...totals,
        diffs,
        docs: DOCS,
      },
      null,
      2,
    ),
  );
}

main();
