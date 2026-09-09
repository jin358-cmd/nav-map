#!/usr/bin/env node
/**
 * Measure /api/suggest latency for Phase 5.2 P0 queries.
 */
import { writeFileSync } from "node:fs";
const BASE = process.env.SUGGEST_BASE_URL ?? "http://127.0.0.1:43145";
const QUERIES = [
  "全",
  "全家",
  "全聯",
  "7",
  "711",
  "7-ELEVEN",
  "星",
  "星巴克",
  "麥",
  "麥當勞",
  "加",
  "加油站",
  "停",
  "停車場",
  "藥",
  "藥局",
  "醫",
  "醫院",
  "海",
];
const CITIES = [
  { name: "台北", lat: 25.0478, lng: 121.517 },
  { name: "新北", lat: 25.0169, lng: 121.4628 },
  { name: "桃園", lat: 24.9936, lng: 121.301 },
  { name: "台中", lat: 24.1477, lng: 120.6736 },
  { name: "台南", lat: 22.9908, lng: 120.2049 },
  { name: "高雄", lat: 22.6273, lng: 120.3014 },
];

async function one(q, city) {
  const url = new URL("/api/suggest", BASE);
  url.searchParams.set("q", q);
  url.searchParams.set("lat", String(city.lat));
  url.searchParams.set("lng", String(city.lng));
  const t0 = performance.now();
  const response = await fetch(url, { cache: "no-store" });
  const ms = performance.now() - t0;
  const data = await response.json();
  const names = (data.results ?? []).slice(0, 5).map((row) => row.name || row.label);
  return {
    city: city.name,
    q,
    httpMs: Number(ms.toFixed(1)),
    localMs: data.timings?.localMs ?? null,
    prefixMs: data.timings?.prefixMs ?? null,
    fallbackMs: data.timings?.fallbackMs ?? null,
    stage: data.stage,
    count: (data.results ?? []).length,
    names,
  };
}

async function main() {
  const warmupT0 = performance.now();
  try {
    await one("全", CITIES[4]);
  } catch {
    /* first hit may include gzip index load */
  }
  const warmupMs = Number((performance.now() - warmupT0).toFixed(1));
  const rows = [];
  for (const city of CITIES) {
    for (const q of QUERIES) {
      try {
        rows.push(await one(q, city));
      } catch (error) {
        rows.push({
          city: city.name,
          q,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }
  const ok = rows.filter((row) => row.httpMs != null);
  const avg = ok.length
    ? ok.reduce((sum, row) => sum + row.httpMs, 0) / ok.length
    : null;
  const nearby = [];
  for (const city of CITIES) {
    const url = new URL("/api/pois", BASE);
    url.searchParams.set("nearby", "1");
    url.searchParams.set("lat", String(city.lat));
    url.searchParams.set("lng", String(city.lng));
    url.searchParams.set("radius", "2000");
    url.searchParams.set("limit", "16");
    const t0 = performance.now();
    try {
      const response = await fetch(url, { cache: "no-store" });
      const ms = performance.now() - t0;
      const data = await response.json();
      nearby.push({
        city: city.name,
        httpMs: Number(ms.toFixed(1)),
        count: (data.pois ?? []).length,
      });
    } catch (error) {
      nearby.push({
        city: city.name,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
  const nearbyOk = nearby.filter((row) => row.httpMs != null);
  const nearbyAvg = nearbyOk.length
    ? nearbyOk.reduce((sum, row) => sum + row.httpMs, 0) / nearbyOk.length
    : null;
  const report = {
    base: BASE,
    warmupHttpMs: warmupMs,
    averageHttpMs: avg ? Number(avg.toFixed(1)) : null,
    nearbyAverageHttpMs: nearbyAvg ? Number(nearbyAvg.toFixed(1)) : null,
    androidDevice: "NOT AVAILABLE in this environment",
    indexes: "in-memory prefix / brand / alias / category / geohash (no Postgres EXPLAIN ANALYZE)",
    nearby,
    rows,
  };
  console.log(JSON.stringify(report, null, 2));
  writeFileSync("docs/poi-suggest-measure.json", `${JSON.stringify(report, null, 2)}\n`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
