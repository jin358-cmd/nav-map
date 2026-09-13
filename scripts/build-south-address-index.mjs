#!/usr/bin/env node
/**
 * Build NLSC-derived southern doorplate staging from located POIs.
 * This is not an official county doorplate file.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { addressParts, cityFromAddress, districtFromAddress } from "./gcis-address.mjs";
import {
  DATA_VERSION,
  SOUTH_PILOT_SET,
  classifyRow,
  loadPoiRows,
  sha256File,
} from "./south-poi-shared.mjs";

const INDEX =
  process.env.NAVPILOT_POI_INDEX ||
  (existsSync("/tmp/phase53a-src/taiwan-poi-index.json.gz")
    ? "/tmp/phase53a-src/taiwan-poi-index.json.gz"
    : "src/data/taiwan-poi-index.json.gz");

const OUT_DIR = "data/south-pilot";
const SRC_INDEX = "src/data/south-address-index.json.gz";
const BOXES = "src/data/taiwan-admin-boxes.json";
const MANIFEST = "data/south-pilot/address-index-manifest.json";

function accuracyFromQuality(quality, address) {
  const parts = addressParts(address);
  if (quality === "A" || quality === "B") return "exact-house";
  if (quality === "C") return parts.hasLane ? "lane-center" : "approximate";
  if (quality === "D") return "road-center";
  if (parts.hasHouse) return "interpolated";
  if (parts.hasLane) return "lane-center";
  if (parts.hasRoad) return "road-center";
  return "approximate";
}

function expandBox(map, county, district, lat, lng) {
  if (!county || !district) return;
  if (!map[county]) map[county] = {};
  const prev = map[county][district];
  if (!prev) {
    map[county][district] = {
      south: lat,
      north: lat,
      west: lng,
      east: lng,
      count: 1,
      source: "derived-from-located-pois",
    };
    return;
  }
  prev.south = Math.min(prev.south, lat);
  prev.north = Math.max(prev.north, lat);
  prev.west = Math.min(prev.west, lng);
  prev.east = Math.max(prev.east, lng);
  prev.count += 1;
}

function padBox(box, pad = 0.015) {
  return {
    south: Number((box.south - pad).toFixed(4)),
    north: Number((box.north + pad).toFixed(4)),
    west: Number((box.west - pad).toFixed(4)),
    east: Number((box.east + pad).toFixed(4)),
    source: box.source,
  };
}

function main() {
  if (!existsSync(INDEX)) {
    console.error(JSON.stringify({ stop: true, reason: "missing_poi_index", looked: INDEX }));
    process.exit(2);
  }
  mkdirSync(OUT_DIR, { recursive: true });
  const rows = loadPoiRows(INDEX);
  const unique = new Map();
  const districtAcc = {};
  let southLocated = 0;
  for (const raw of rows) {
    const row = classifyRow(raw);
    if (!row.located) continue;
    southLocated += 1;
    const city = cityFromAddress(row.address) || row.county;
    const town = districtFromAddress(row.address, city || "") || row.district;
    if (!SOUTH_PILOT_SET.has(city)) continue;
    expandBox(districtAcc, city, town, row.latitude, row.longitude);
    const parts = addressParts(row.address);
    if (!parts.hasHouse && !parts.hasLane && !parts.hasRoad) continue;
    const display = row.address;
    const key = [
      parts.city,
      parts.town,
      parts.road,
      parts.section,
      parts.lane,
      parts.alley,
      parts.number,
      parts.subNumber,
    ].join("|");
    const accuracy = accuracyFromQuality(row.qualityGrade, row.address);
    const prev = unique.get(key);
    const rank = accuracy === "exact-house" ? 3 : accuracy === "interpolated" ? 2 : 1;
    const prevRank = prev
      ? prev.a === "exact-house"
        ? 3
        : prev.a === "interpolated"
          ? 2
          : 1
      : 0;
    if (!prev || rank > prevRank) {
      unique.set(key, {
        n: display.replaceAll("臺", "台").replace(/\s+/g, ""),
        d: display,
        lat: Number(row.latitude.toFixed(6)),
        lng: Number(row.longitude.toFixed(6)),
        c: parts.city || city,
        t: parts.town || town || "",
        r: parts.road,
        s: parts.section,
        h: parts.number ? `${parts.number}${parts.subNumber ? `之${parts.subNumber}` : ""}號` : "",
        a: accuracy,
        k: key,
      });
    }
  }

  const records = [...unique.values()].sort((a, b) => a.n.localeCompare(b.n, "zh-Hant"));
  const payload = {
    version: `south-address-nlsc-derived-${DATA_VERSION}`,
    source: "nlsc-derived",
    notOfficialCountyFile: true,
    license: "OGDL-Taiwan-1.0 + NLSC runtime match; not a licensed county doorplate dump",
    count: records.length,
    rows: records,
  };
  const json = `${JSON.stringify(payload)}\n`;
  const gz = gzipSync(Buffer.from(json));
  writeFileSync(`${OUT_DIR}/address-index.json.gz`, gz);
  writeFileSync(SRC_INDEX, gz);

  const seed = existsSync(BOXES) ? JSON.parse(readFileSync(BOXES, "utf8")) : { counties: {}, districts: {} };
  const districts = {
    臺北市: seed.districts?.臺北市 || {},
  };
  let derivedDistricts = 0;
  for (const [county, group] of Object.entries(districtAcc)) {
    if (!districts[county]) districts[county] = {};
    for (const [town, box] of Object.entries(group)) {
      if (box.count < 8) continue;
      const padded = padBox(box);
      const existing = districts[county][town];
      if (existing?.source === "seed") {
        districts[county][town] = {
          south: Math.min(existing.south, padded.south),
          north: Math.max(existing.north, padded.north),
          west: Math.min(existing.west, padded.west),
          east: Math.max(existing.east, padded.east),
          source: "seed+derived",
        };
      } else {
        districts[county][town] = padded;
      }
      derivedDistricts += 1;
    }
  }
  const nextBoxes = {
    ...seed,
    version: "admin-boxes-20260913-derived",
    updatedAt: new Date().toISOString(),
    districts,
  };
  writeFileSync(BOXES, `${JSON.stringify(nextBoxes, null, 2)}\n`);

  const byCounty = {};
  const byAccuracy = {};
  for (const row of records) {
    byCounty[row.c || "未知"] = (byCounty[row.c || "未知"] || 0) + 1;
    byAccuracy[row.a] = (byAccuracy[row.a] || 0) + 1;
  }
  const manifest = {
    dataset: "南部本機門牌 staging（NLSC 衍生）",
    status: "nlsc-derived",
    notOfficialCountyFile: true,
    sourceIndex: INDEX,
    sourceSha256: sha256File(INDEX),
    output: SRC_INDEX,
    outputSha256: sha256File(SRC_INDEX),
    bytes: gz.length,
    uniqueAddresses: records.length,
    southLocatedPois: southLocated,
    byCounty,
    byAccuracy,
    derivedDistricts,
    supabase: "not_written",
    note: "未確認 NavPilot Supabase 前只寫本機 staging，不得標成各縣市合法門牌原始檔。",
  };
  writeFileSync(MANIFEST, `${JSON.stringify(manifest, null, 2)}\n`);
  writeFileSync("docs/phase-5-3a-address-index-manifest.json", `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(JSON.stringify({ ...manifest, sourceSha256: manifest.sourceSha256?.slice(0, 12) }, null, 2));
}

main();
