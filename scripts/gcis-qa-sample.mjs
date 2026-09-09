#!/usr/bin/env node
/**
 * Phase 5.2 search-quality sample against local Suggest.
 */
import { writeFileSync } from "node:fs";

const BASE = process.env.SUGGEST_BASE_URL ?? "http://127.0.0.1:43145";
const ORIGIN = { lat: 22.9908, lng: 120.2049 };
const QUERIES = [
  "7",
  "711",
  "全家",
  "全聯",
  "星巴克",
  "麥當勞",
  "中油",
  "家樂福",
  "餐廳",
  "咖啡",
  "藥局",
  "醫院",
  "停車場",
  "加油站",
  "服飾",
  "飯店",
];

async function sample(q) {
  const url = new URL("/api/suggest", BASE);
  url.searchParams.set("q", q);
  url.searchParams.set("lat", String(ORIGIN.lat));
  url.searchParams.set("lng", String(ORIGIN.lng));
  const t0 = performance.now();
  const response = await fetch(url, { cache: "no-store" });
  const ms = performance.now() - t0;
  const data = await response.json();
  const results = (data.results ?? []).slice(0, 8).map((row) => ({
    name: row.name || row.label,
    address: row.address || row.formattedAddress,
    score: row.navEligibilityScore ?? null,
    incomplete: Boolean(row.locationIncomplete),
    category: row.category ?? null,
  }));
  return { q, httpMs: Number(ms.toFixed(1)), count: (data.results ?? []).length, results };
}

async function main() {
  const rows = [];
  for (const q of QUERIES) {
    try {
      rows.push(await sample(q));
    } catch (error) {
      rows.push({ q, error: error instanceof Error ? error.message : String(error) });
    }
  }
  writeFileSync("docs/gcis-search-sample.json", `${JSON.stringify({ origin: ORIGIN, rows }, null, 2)}\n`);
  console.log(JSON.stringify({ sampled: rows.length, rows }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
