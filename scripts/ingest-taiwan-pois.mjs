#!/usr/bin/env node
/**
 * Controlled OSM batch ingest for NavPilot POI MVP.
 * Legal source: OpenStreetMap via Nominatim + Photon (ODbL).
 */
import { writeFileSync } from "node:fs";

const USER_AGENT = "NavPilot/0.1 (https://github.com/jin358-cmd/nav-map)";
const NOMINATIM = "https://nominatim.openstreetmap.org/search";
const PHOTON = "https://photon.komoot.io/api/";
const OUT = "src/data/taiwan-poi-index.json";

const CITIES = [
  { county: "臺北市", q: "Taipei" },
  { county: "新北市", q: "New Taipei" },
  { county: "桃園市", q: "Taoyuan" },
  { county: "臺中市", q: "Taichung" },
  { county: "臺南市", q: "Tainan" },
  { county: "高雄市", q: "Kaohsiung" },
  { county: "花蓮縣", q: "Hualien" },
  { county: "澎湖縣", q: "Penghu" },
];

const QUERIES = [
  { q: "7-Eleven", category: "convenience", brand: "7-Eleven", aliases: ["711", "7-11", "統一超商"] },
  { q: "FamilyMart", category: "convenience", brand: "FamilyMart", aliases: ["全家", "全家便利商店"] },
  { q: "Starbucks", category: "cafe", brand: "Starbucks", aliases: ["星巴克"] },
  { q: "McDonald's", category: "restaurant", brand: "McDonald's", aliases: ["麥當勞"] },
  { q: "gas station", category: "fuel", brand: null, aliases: ["加油站", "加油"] },
  { q: "parking", category: "parking", brand: null, aliases: ["停車場", "停車"] },
  { q: "hospital", category: "hospital", brand: null, aliases: ["醫院"] },
  { q: "pharmacy", category: "pharmacy", brand: null, aliases: ["藥局", "藥房"] },
];

const LANDMARKS = [
  { q: "Taipei Main Station", category: "landmark", aliases: ["臺北車站", "台北車站", "台北火車站"] },
  { q: "Chimei Museum", category: "landmark", aliases: ["奇美博物館"] },
  { q: "Kaohsiung Station", category: "landmark", aliases: ["高雄車站"] },
  { q: "Hualien Station", category: "landmark", aliases: ["花蓮車站"] },
];

function normalize(value) {
  return String(value ?? "")
    .toLowerCase()
    .replaceAll("臺", "台")
    .replace(/[\s\-_.＋+]/g, "");
}

function inTaiwan(lat, lng) {
  return lng >= 118 && lng <= 123 && lat >= 20 && lat <= 27;
}

function countyFromText(text, fallback) {
  const match = String(text).match(
    /(臺北市|台北市|新北市|桃園市|臺中市|台中市|臺南市|台南市|高雄市|花蓮縣|澎湖縣|臺東縣|台東縣)/,
  );
  return match?.[1]?.replaceAll("台", "臺") ?? fallback ?? null;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchJson(url) {
  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
      "Accept-Language": "zh-TW",
      "User-Agent": USER_AGENT,
    },
  });
  if (!response.ok) throw new Error(`${response.status} ${url}`);
  return response.json();
}

function pushRow(map, row) {
  if (!row || !inTaiwan(row.latitude, row.longitude)) return;
  const key = `${row.source}:${row.sourceId}`;
  if (map.has(key)) return;
  map.set(key, row);
}

async function searchPhoton(query, meta, county) {
  const url = new URL(PHOTON);
  url.searchParams.set("q", `${query} ${county}`);
  url.searchParams.set("limit", "10");
  const payload = await fetchJson(url);
  return (payload.features ?? []).map((feature) => {
    const lng = Number(feature.geometry?.coordinates?.[0]);
    const lat = Number(feature.geometry?.coordinates?.[1]);
    const name = feature.properties?.name || query;
    const address = [
      feature.properties?.state,
      feature.properties?.district,
      feature.properties?.street,
      feature.properties?.housenumber,
    ]
      .filter(Boolean)
      .join("");
    return {
      id: `osm-${feature.properties?.osm_type ?? "n"}-${feature.properties?.osm_id ?? `${lng},${lat}`}`,
      name,
      nameNormalized: normalize(name),
      aliases: meta.aliases,
      category: meta.category,
      brand: meta.brand,
      address: address || meta.county || "",
      county: countyFromText(address, meta.county),
      district: feature.properties?.district ?? null,
      latitude: lat,
      longitude: lng,
      source: "osm",
      sourceId: String(feature.properties?.osm_id ?? `${lng.toFixed(5)},${lat.toFixed(5)}`),
      updatedAt: new Date().toISOString(),
      license: "ODbL",
    };
  });
}

async function searchNominatim(query, meta, county) {
  const url = new URL(NOMINATIM);
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("countrycodes", "tw");
  url.searchParams.set("limit", "8");
  url.searchParams.set("addressdetails", "1");
  url.searchParams.set("q", county ? `${query} ${county}` : query);
  const payload = await fetchJson(url);
  return (Array.isArray(payload) ? payload : []).map((item) => ({
    id: `osm-${item.osm_type ?? "n"}-${item.osm_id ?? item.place_id}`,
    name: item.name || String(item.display_name ?? query).split(",")[0],
    nameNormalized: normalize(item.name || query),
    aliases: meta.aliases,
    category: meta.category,
    brand: meta.brand,
    address: String(item.display_name ?? "").replace(/\s+/g, ""),
    county: countyFromText(item.display_name, meta.county),
    district: item.address?.suburb || item.address?.city_district || null,
    latitude: Number(item.lat),
    longitude: Number(item.lon),
    source: "osm",
    sourceId: String(item.osm_id ?? item.place_id),
    updatedAt: new Date().toISOString(),
    license: "ODbL",
  }));
}

async function main() {
  const map = new Map();
  const jobs = [];
  for (const city of CITIES) {
    for (const item of QUERIES) {
      jobs.push({ ...item, city });
    }
  }
  for (const item of LANDMARKS) {
    jobs.push({ ...item, city: null });
  }

  let failed = 0;
  for (const [index, job] of jobs.entries()) {
    const place = job.city?.q ?? "";
    process.stdout.write(`ingest ${index + 1}/${jobs.length} ${place} ${job.q}\n`);
    try {
      const photonRows = await searchPhoton(job.q, { ...job, county: job.city?.county ?? null }, place);
      for (const row of photonRows) pushRow(map, row);
      if (photonRows.length < 4) {
        await sleep(1100);
        const nominatimRows = await searchNominatim(
          job.q,
          { ...job, county: job.city?.county ?? null },
          place,
        );
        for (const row of nominatimRows) pushRow(map, row);
      } else {
        await sleep(220);
      }
    } catch (error) {
      failed += 1;
      console.error(`skip ${job.q} ${place}: ${error instanceof Error ? error.message : error}`);
      await sleep(900);
    }
  }

  const rows = [...map.values()].sort((a, b) => a.name.localeCompare(b.name, "zh-Hant"));
  writeFileSync(OUT, `${JSON.stringify(rows, null, 2)}\n`);
  const bySource = {};
  const byCategory = {};
  const byCounty = {};
  for (const row of rows) {
    bySource[row.source] = (bySource[row.source] ?? 0) + 1;
    byCategory[row.category] = (byCategory[row.category] ?? 0) + 1;
    byCounty[row.county ?? "未知"] = (byCounty[row.county ?? "未知"] ?? 0) + 1;
  }
  const report = {
    dataset: "taiwan_poi_index",
    source: "OpenStreetMap via Nominatim/Photon",
    license: "ODbL",
    total: rows.length,
    failed,
    bySource,
    byCategory,
    byCounty,
    written: OUT,
  };
  writeFileSync("docs/poi-ingest-report.json", `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify(report, null, 2));
  if (rows.length < 40) process.exitCode = 2;
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
