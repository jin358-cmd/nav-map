#!/usr/bin/env node
/**
 * One-shot NLSC retry for reconstructed Batch 10 failures.
 * Road / lane centers go to review only. Does not write Supabase or the POI index.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { cacheKey, cityFromAddress, classifyMatchQuality } from "./gcis-address.mjs";
import { geocodeNlscImproved } from "./nlsc-geocode.mjs";
import { qualityAllowsStorefrontNav } from "./gcis-address.mjs";

const LIST = "data/south-pilot/nlsc-fail-reconstructed.jsonl";
const GEO_CACHE = "src/data/gcis-geocode-cache.json";
const OUT_RECOVERED = "data/south-pilot/nlsc-retry-recovered.jsonl";
const OUT_STILL = "data/south-pilot/nlsc-retry-still-fail.jsonl";
const OUT_REPORT = "docs/phase-5-3a-nlsc-retry.json";
const CONCURRENCY = Math.max(1, Number(process.env.NLSC_RETRY_CONCURRENCY ?? 4));
const DELAY_MS = Number(process.env.NLSC_RETRY_DELAY_MS ?? 80);
const LIMIT = Number(process.env.NLSC_RETRY_LIMIT ?? 0);

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function mapPool(items, limit, worker) {
  const out = new Array(items.length);
  let cursor = 0;
  async function run() {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      out[index] = await worker(items[index], index);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, run));
  return out;
}

function loadRows() {
  if (!existsSync(LIST)) {
    throw new Error("先跑 node scripts/reconstruct-nlsc-fails.mjs");
  }
  return readFileSync(LIST, "utf8")
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

function pickRetrySet(rows) {
  const recoverable = rows.filter(
    (row) =>
      row.retryable ||
      row.reason === "parse_failed" ||
      row.reason === "rural_address_without_road" ||
      row.reason === "timeout_or_transport" ||
      row.queryChanged,
  );
  const rest = rows.filter((row) => !recoverable.includes(row));
  // One-shot for remaining official_source_empty (including south).
  const combined = [...recoverable, ...rest];
  if (LIMIT > 0) return combined.slice(0, LIMIT);
  return combined;
}

async function main() {
  mkdirSync("data/south-pilot", { recursive: true });
  const all = loadRows();
  const queued = pickRetrySet(all);
  const geoCache = existsSync(GEO_CACHE) ? JSON.parse(readFileSync(GEO_CACHE, "utf8")) : {};
  const recovered = [];
  const still = [];
  const byOutcome = {
    exact_or_nav: 0,
    review_lane_or_road: 0,
    still_empty: 0,
    transport_error: 0,
  };

  console.log(`[nlsc-retry] queue ${queued.length} / reconstructed ${all.length}`);
  let done = 0;
  await mapPool(queued, CONCURRENCY, async (row) => {
    const city = row.city || cityFromAddress(row.address);
    const result = await geocodeNlscImproved(row.address, city);
    await sleep(DELAY_MS);
    const addrKey = cacheKey(row.address);
    if (result.httpError && !result.hit) {
      byOutcome.transport_error += 1;
      still.push({
        ...row,
        retry: "transport_error",
        usedQuery: result.usedQuery,
      });
      return;
    }
    if (!result.hit) {
      byOutcome.still_empty += 1;
      if (addrKey) geoCache[addrKey] = { miss: true, at: new Date().toISOString(), retry: "2026-09-13-improved" };
      still.push({
        ...row,
        retry: "official_source_empty",
        usedQuery: result.usedQuery,
        improvedQuery: result.improved,
      });
      return;
    }
    const quality = classifyMatchQuality(row.address, result.hit);
    const nav = qualityAllowsStorefrontNav(quality);
    const reviewOnly = quality === "C" || quality === "D";
    if (addrKey) {
      geoCache[addrKey] = {
        ...result.hit,
        quality,
        at: new Date().toISOString(),
        retry: "2026-09-13-improved",
      };
    }
    const record = {
      ...row,
      retry: nav ? "recovered_nav" : reviewOnly ? "review_only" : "recovered_other",
      quality,
      hit: result.hit,
      usedQuery: result.usedQuery,
    };
    if (nav) byOutcome.exact_or_nav += 1;
    else if (reviewOnly) byOutcome.review_lane_or_road += 1;
    else byOutcome.still_empty += 1;
    if (nav || reviewOnly) recovered.push(record);
    else still.push(record);
    done += 1;
    if (done % 100 === 0) console.log(`[nlsc-retry] ${done}/${queued.length} recovered=${recovered.length} still=${still.length}`);
  });

  writeFileSync(GEO_CACHE, `${JSON.stringify(geoCache)}\n`);
  writeFileSync(OUT_RECOVERED, `${recovered.map((row) => JSON.stringify(row)).join("\n")}${recovered.length ? "\n" : ""}`);
  writeFileSync(OUT_STILL, `${still.map((row) => JSON.stringify(row)).join("\n")}${still.length ? "\n" : ""}`);

  const southRecovered = recovered.filter((row) => row.south && row.retry === "recovered_nav").length;
  const report = {
    reconstructed: all.length,
    retried: queued.length,
    recoveredNav: byOutcome.exact_or_nav,
    reviewOnly: byOutcome.review_lane_or_road,
    stillEmpty: byOutcome.still_empty,
    transportError: byOutcome.transport_error,
    southRecoveredNav: southRecovered,
    wroteSupabase: false,
    wrotePoiIndex: false,
    updatedGeocodeCache: true,
    outputs: { recovered: OUT_RECOVERED, stillFail: OUT_STILL, cache: GEO_CACHE },
    note: "道路／巷弄中心只進 review。未寫入 taiwan_address_index 或 POI 索引。",
  };
  writeFileSync(OUT_REPORT, `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify(report, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
