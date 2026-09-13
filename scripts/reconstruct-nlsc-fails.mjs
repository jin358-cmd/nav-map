#!/usr/bin/env node
/**
 * Reconstruct Batch 10 NLSC failures from GCIS catalog vs located POI / geocode cache.
 * The original 2,121 rows were not kept in gcis-import-rejects.jsonl.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { cacheKey } from "./gcis-address.mjs";
import { loadActiveShops } from "./gcis-load-active-shops.mjs";
import { loadPoiRows } from "./south-poi-shared.mjs";
import { nlscQueryImproved, nlscQueryLegacy } from "./nlsc-geocode.mjs";

const SOUTH = ["雲林縣", "嘉義市", "嘉義縣", "臺南市", "高雄市", "屏東縣"];
const INDEX =
  process.env.NAVPILOT_POI_INDEX ||
  (existsSync("/tmp/phase53a-src/taiwan-poi-index.json.gz")
    ? "/tmp/phase53a-src/taiwan-poi-index.json.gz"
    : "src/data/taiwan-poi-index.json.gz");
const GEO_CACHE = "src/data/gcis-geocode-cache.json";
const OUT_JSONL = "data/south-pilot/nlsc-fail-reconstructed.jsonl";
const OUT_REPORT = "docs/phase-5-3a-geo-fail-classify.json";

function classify(address, reason) {
  const text = String(address || "").trim();
  if (!text) return "missing_admin_unit";
  if (reason === "out_of_taiwan") return "invalid_coordinate";
  if (/timeout|ECONN|ETIMEDOUT|fetch/i.test(String(reason || ""))) return "timeout_or_transport";
  if (!/[縣市]/.test(text)) return "missing_admin_unit";
  if (!/(?:路|街|大道|道|巷|弄)/.test(text) && /[村里].*鄰/.test(text)) {
    return "rural_address_without_road";
  }
  if (!/\d+號/.test(text) && !/\d+[-之]/.test(text)) return "parse_failed";
  if (reason === "quality_c_or_worse") return "official_source_empty";
  return "official_source_empty";
}

function retryable(reason) {
  return (
    reason === "parse_failed" ||
    reason === "rural_address_without_road" ||
    reason === "timeout_or_transport"
  );
}

function main() {
  if (!existsSync(INDEX)) {
    console.error(JSON.stringify({ stop: true, reason: "missing_poi_index", looked: INDEX }));
    process.exit(2);
  }
  mkdirSync("data/south-pilot", { recursive: true });
  const { list, missingCsv, files } = loadActiveShops();
  const located = loadPoiRows(INDEX);
  const locatedTax = new Set();
  const locatedAddr = new Set();
  for (const row of located) {
    if (row.source === "gov" && row.sourceId) locatedTax.add(String(row.sourceId));
    if (row.address) locatedAddr.add(cacheKey(row.address));
  }
  const geoCache = existsSync(GEO_CACHE) ? JSON.parse(readFileSync(GEO_CACHE, "utf8")) : {};

  const fails = [];
  for (const shop of list) {
    if (!shop.addrKey || shop.addrKey.length < 6) continue;
    if (locatedTax.has(shop.taxId)) continue;
    const cached = geoCache[shop.addrKey];
    if (cached?.lat && cached?.lng && cached.kind !== "CROSSROAD") continue;
    if (!cached && locatedAddr.has(shop.addrKey)) continue;
    const reason = classify(shop.address, cached?.reason);
    const improved = nlscQueryImproved(shop.address);
    const legacy = nlscQueryLegacy(shop.address);
    fails.push({
      registry_id: shop.taxId,
      name: shop.name,
      address: shop.address,
      city: shop.city,
      kind: shop.kind,
      reason,
      retryable: retryable(reason) || improved !== legacy,
      queryChanged: improved !== legacy,
      improvedQuery: improved,
      legacyQuery: legacy,
      south: SOUTH.includes(String(shop.city || "").replaceAll("台", "臺")),
      reconstructed: true,
      source: "gcis-catalog-minus-located-index",
    });
  }

  const byReason = {};
  const southReasons = {};
  let south = 0;
  let willRetry = 0;
  for (const row of fails) {
    byReason[row.reason] = (byReason[row.reason] || 0) + 1;
    if (row.south) {
      south += 1;
      southReasons[row.reason] = (southReasons[row.reason] || 0) + 1;
    }
    if (row.retryable) willRetry += 1;
  }

  writeFileSync(OUT_JSONL, `${fails.map((row) => JSON.stringify(row)).join("\n")}${fails.length ? "\n" : ""}`);

  const report = {
    source: "reconstructed from GCIS CSVs minus located POI index / geocode hits",
    expectedGeoFail: 2121,
    reconstructed: fails.length,
    deltaFromExpected: fails.length - 2121,
    south,
    missingCsv,
    catalogFiles: files,
    uniqueActiveShops: list.length,
    locatedGovInIndex: locatedTax.size,
    allReasons: byReason,
    southReasons,
    retryPolicy: {
      willRetry: ["parse_failed", "rural_address_without_road", "timeout_or_transport", "query_changed"],
      willNotRetrySecondPass: ["official_source_empty after one improved query"],
      note: "巷弄／道路中心只能進 review，不得自動 nav-ready。official_source_empty 只重打一次改善過的 query。",
    },
    outputs: { jsonl: OUT_JSONL, count: fails.length, retryable: willRetry },
    missing: fails.length === 0 ? ["無法從目錄重建任何失敗列"] : [],
  };
  writeFileSync(OUT_REPORT, `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify(report, null, 2));
}

main();
