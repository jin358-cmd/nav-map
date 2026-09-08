#!/usr/bin/env node
/**
 * Update Taiwan POI index from official national chain store locators.
 * Convenience stores first (7-ELEVEN, FamilyMart). Hi-Life / OK Mart when the
 * public locator answers. Also remaps mainCategory to 中華黃頁 classes.
 *
 * Legal: official brand websites / public store maps. Not Google Places.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { gunzipSync, gzipSync } from "node:zlib";
import { yellowPagesLayerFromTags } from "./yellow-pages.mjs";

const USER_AGENT =
  "NavPilot/0.1 (https://github.com/jin358-cmd/nav-map; store-locator ingest)";
const BROWSER_UA =
  "Mozilla/5.0 (compatible; NavPilot/0.1; +https://github.com/jin358-cmd/nav-map) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";
const OUT = "src/data/taiwan-poi-index.json";
const GZ = "src/data/taiwan-poi-index.json.gz";
const MANIFEST = "src/data/poi-ingest-manifest.json";
const REPORT = "docs/poi-chain-ingest-report.json";
const CHECKPOINT = "src/data/poi-chain-ingest-checkpoint.json";
const FAMILMART_KEY = "6F30E8BF706D653965BDE302661D1241F8BE9EBC";
const DELAY_MS = Number(process.env.CHAIN_INGEST_DELAY_MS || 180);
const MATCH_METERS = 50;

const ALL_CITIES = [
  "台北市",
  "新北市",
  "桃園市",
  "台中市",
  "台南市",
  "高雄市",
  "基隆市",
  "新竹市",
  "嘉義市",
  "新竹縣",
  "苗栗縣",
  "彰化縣",
  "南投縣",
  "雲林縣",
  "嘉義縣",
  "屏東縣",
  "宜蘭縣",
  "花蓮縣",
  "台東縣",
  "澎湖縣",
  "金門縣",
  "連江縣",
];
const cityFilter = (process.env.CHAIN_INGEST_CITY || "").trim();
const CITIES = cityFilter ? ALL_CITIES.filter((city) => city === cityFilter) : ALL_CITIES;

const FALLBACK_TOWNS = {
  台北市: [
    "中正區",
    "大同區",
    "中山區",
    "松山區",
    "大安區",
    "萬華區",
    "信義區",
    "士林區",
    "北投區",
    "內湖區",
    "南港區",
    "文山區",
  ],
  新北市: [
    "板橋區",
    "三重區",
    "中和區",
    "永和區",
    "新莊區",
    "新店區",
    "土城區",
    "蘆洲區",
    "汐止區",
    "樹林區",
    "鶯歌區",
    "三峽區",
    "淡水區",
    "瑞芳區",
    "五股區",
    "泰山區",
    "林口區",
    "深坑區",
    "石碇區",
    "坪林區",
    "三芝區",
    "石門區",
    "八里區",
    "平溪區",
    "雙溪區",
    "貢寮區",
    "金山區",
    "萬里區",
    "烏來區",
  ],
};

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function compact(value) {
  return String(value || "")
    .toLowerCase()
    .replaceAll("臺", "台")
    .replace(/[（）()]/g, "")
    .replace(/[\s\-_.＋+]/g, "");
}

function cityVariants(city) {
  return [...new Set([city, city.replaceAll("台", "臺"), city.replaceAll("臺", "台")])];
}

function xmlTag(xml, tag) {
  const match = xml.match(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`, "i"));
  return match ? match[1].trim() : "";
}

function parseCoord(raw) {
  const n = Number(String(raw).trim());
  if (!Number.isFinite(n) || n === 0) return null;
  if (Math.abs(n) > 1000) return n / 1e6;
  return n;
}

function distanceMeters(a, b) {
  const R = 6371000;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

function inferCityDistrict(address, fallbackCity) {
  const text = String(address || "");
  const cityMatch = text.match(
    /(台北市|臺北市|新北市|桃園市|台中市|臺中市|台南市|臺南市|高雄市|基隆市|新竹市|嘉義市|新竹縣|苗栗縣|彰化縣|南投縣|雲林縣|嘉義縣|屏東縣|宜蘭縣|花蓮縣|台東縣|臺東縣|澎湖縣|金門縣|連江縣)/,
  );
  const city = cityMatch?.[1] || fallbackCity || null;
  const rest = city ? text.slice(text.indexOf(city) + city.length) : text;
  const districtMatch = rest.match(/^(.{1,3}[鄉鎮市區])/);
  return { city, district: districtMatch?.[1] || null };
}

function splitBranch(name, brandLabel) {
  const compactName = compact(name);
  const compactLabel = compact(brandLabel);
  let rest = name.replace(brandLabel, "").replace(/7-?ELEVEN/i, "").replace(/統一超商/g, "");
  rest = rest.replace(/全家便利商店/g, "").replace(/全家/g, "");
  rest = rest.replace(/^[\s\-_/]+/, "").replace(/[\s\-_/]+$/, "").trim();
  rest = rest.replace(/^的/, "").trim();
  if (rest && rest.length >= 1 && rest !== compactName) {
    return rest;
  }
  if (compactName.includes(compactLabel) && compactName.length > compactLabel.length + 1) {
    return name.replace(/^(7-?ELEVEN|統一超商|全家便利商店|全家)/i, "").trim() || null;
  }
  return null;
}

async function fetchText(url, options = {}, retries = 3) {
  let lastError = null;
  for (let i = 0; i < retries; i += 1) {
    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          "User-Agent": options.headers?.["User-Agent"] || BROWSER_UA,
          ...options.headers,
        },
      });
      if (response.status === 403 || response.status === 404) {
        return { ok: false, status: response.status, text: "" };
      }
      const text = await response.text();
      if (!response.ok) {
        lastError = new Error(`HTTP ${response.status}`);
        await sleep(400 * (i + 1));
        continue;
      }
      return { ok: true, status: response.status, text };
    } catch (error) {
      lastError = error;
      await sleep(400 * (i + 1));
    }
  }
  return { ok: false, status: 0, text: "", error: lastError };
}

function unwrapJsonp(text, fnName) {
  const trimmed = String(text || "").trim();
  if (!trimmed) return [];
  if (trimmed.startsWith("[") || trimmed.startsWith("{")) {
    try {
      const parsed = JSON.parse(trimmed);
      return Array.isArray(parsed) ? parsed : parsed.list || parsed.data || [];
    } catch {
      return [];
    }
  }
  const match = trimmed.match(new RegExp(`${fnName}\\s*\\(([\\s\\S]*)\\)\\s*;?\\s*$`));
  if (!match) return [];
  try {
    return JSON.parse(match[1]);
  } catch {
    return [];
  }
}

async function familyTowns(city) {
  const url = `https://api.map.com.tw/net/familyShop.aspx?searchType=ShowTownList&type=&fun=showTownList&city=${encodeURIComponent(city)}&key=${FAMILMART_KEY}`;
  const result = await fetchText(url, {
    headers: { Referer: "https://www.family.com.tw/", Origin: "https://www.family.com.tw" },
  });
  await sleep(DELAY_MS);
  if (!result.ok) return [];
  const rows = unwrapJsonp(result.text, "showTownList");
  return rows
    .map((row) => String(row.town || row.area || row.name || row.district || "").trim())
    .filter(Boolean);
}

async function familyStores(city, town) {
  const url = `https://api.map.com.tw/net/familyShop.aspx?searchType=ShopList&type=&city=${encodeURIComponent(city)}&area=${encodeURIComponent(town)}&road=&fun=showStoreList&key=${FAMILMART_KEY}`;
  const result = await fetchText(url, {
    headers: { Referer: "https://www.family.com.tw/", Origin: "https://www.family.com.tw" },
  });
  await sleep(DELAY_MS);
  if (!result.ok) return [];
  const rows = unwrapJsonp(result.text, "showStoreList");
  const out = [];
  for (const row of rows) {
    const lng = parseCoord(row.px ?? row.lon ?? row.lng);
    const lat = parseCoord(row.py ?? row.lat);
    const name = String(row.NAME || row.name || "").trim();
    if (!name || lat == null || lng == null) continue;
    if (lat < 21 || lat > 27 || lng < 118 || lng > 123) continue;
    const address = String(row.addr || row.address || "").trim();
    const { city: parsedCity, district } = inferCityDistrict(address, city);
    out.push({
      sourceId: `fami-${row.pkey || row.SERID || compact(name + address)}`,
      name: name.includes("全家") ? name : `全家便利商店${name}`,
      brand: "FamilyMart",
      brandLabel: "全家便利商店",
      address,
      city: parsedCity || city,
      district: district || town,
      latitude: lat,
      longitude: lng,
      phone: String(row.TEL || row.tel || "").trim() || null,
    });
  }
  return out;
}

async function sevenElevenStores(city, town) {
  const body = new URLSearchParams({
    commandid: "SearchStore",
    city,
    town,
  });
  const result = await fetchText("https://emap.pcsc.com.tw/EMapSDK.aspx", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
      Referer: "https://emap.pcsc.com.tw/",
      Origin: "https://emap.pcsc.com.tw",
    },
    body,
  });
  await sleep(DELAY_MS);
  if (!result.ok) return [];
  const blocks = result.text.split(/<GeoPosition>/i).slice(1);
  const out = [];
  for (const block of blocks) {
    const chunk = block.split(/<\/GeoPosition>/i)[0];
    const id = xmlTag(chunk, "POIID") || xmlTag(chunk, "POI_ID");
    const name = xmlTag(chunk, "POIName") || xmlTag(chunk, "POI_NAME");
    const address = xmlTag(chunk, "Address") || xmlTag(chunk, "ADDRESS");
    const lng = parseCoord(xmlTag(chunk, "X") || xmlTag(chunk, "lng"));
    const lat = parseCoord(xmlTag(chunk, "Y") || xmlTag(chunk, "lat"));
    if (!name || lat == null || lng == null) continue;
    if (lat < 21 || lat > 27 || lng < 118 || lng > 123) continue;
    const { city: parsedCity, district } = inferCityDistrict(address, city);
    const storeName = /7-?eleven|統一超商|小七/i.test(name) ? name : `7-ELEVEN${name}`;
    out.push({
      sourceId: `711-${id || compact(name + address)}`,
      name: storeName,
      brand: "7-Eleven",
      brandLabel: "7-ELEVEN",
      address,
      city: parsedCity || city,
      district: district || town,
      latitude: lat,
      longitude: lng,
      phone: xmlTag(chunk, "Telno") || xmlTag(chunk, "TEL") || null,
    });
  }
  return out;
}

async function townsForCity(city) {
  const towns = new Set();
  for (const variant of cityVariants(city)) {
    const found = await familyTowns(variant);
    for (const town of found) towns.add(town);
    if (found.length) break;
  }
  for (const town of FALLBACK_TOWNS[city] || []) towns.add(town);
  return [...towns];
}

function toRecord(store, now) {
  const branchName = splitBranch(store.name, store.brandLabel);
  const address = store.address || `${store.city || ""}${store.district || ""}`;
  return {
    id: `gov-${store.sourceId}`,
    name: store.name,
    nameNormalized: compact(store.name),
    aliases: [
      compact(store.brand),
      compact(store.brandLabel),
      compact(branchName || ""),
    ].filter(Boolean),
    category: "convenience",
    mainCategory: "food",
    subcategory: "convenience",
    brand: store.brand,
    branchName,
    address,
    addressNormalized: compact(address),
    city: store.city,
    county: store.city,
    district: store.district,
    latitude: store.latitude,
    longitude: store.longitude,
    source: "gov",
    sourceId: store.sourceId,
    updatedAt: now,
    lastSeenAt: now,
    sourceUpdatedAt: now,
    license: "官方門市地圖",
    confidence: 0.96,
    isActive: true,
  };
}

function gridKey(lat, lng) {
  return `${Math.round(lat * 2000)}:${Math.round(lng * 2000)}`;
}

function buildBrandGrid(rows) {
  const grid = new Map();
  for (let i = 0; i < rows.length; i += 1) {
    const row = rows[i];
    if (!row?.brand || !Number.isFinite(row.latitude) || !Number.isFinite(row.longitude)) continue;
    const key = `${row.brand}|${gridKey(row.latitude, row.longitude)}`;
    const bucket = grid.get(key);
    if (bucket) bucket.push(i);
    else grid.set(key, [i]);
  }
  return grid;
}

function findMatch(rows, grid, store) {
  const lat0 = Math.round(store.latitude * 2000);
  const lng0 = Math.round(store.longitude * 2000);
  for (let dLat = -1; dLat <= 1; dLat += 1) {
    for (let dLng = -1; dLng <= 1; dLng += 1) {
      const key = `${store.brand}|${lat0 + dLat}:${lng0 + dLng}`;
      const bucket = grid.get(key) || [];
      for (const index of bucket) {
        const row = rows[index];
        if (row.brand !== store.brand) continue;
        const meters = distanceMeters(
          { lat: row.latitude, lng: row.longitude },
          { lat: store.latitude, lng: store.longitude },
        );
        if (meters <= MATCH_METERS) return index;
      }
    }
  }
  return -1;
}

function loadIndex() {
  try {
    if (existsSync(OUT)) return JSON.parse(readFileSync(OUT, "utf8"));
    if (existsSync(GZ)) return JSON.parse(gunzipSync(readFileSync(GZ)).toString("utf8"));
  } catch {
    return [];
  }
  return [];
}

function writeIndex(rows, extraManifest = {}) {
  mkdirSync("src/data", { recursive: true });
  mkdirSync("docs", { recursive: true });
  const json = JSON.stringify(rows);
  writeFileSync(OUT, `${json}\n`);
  writeFileSync(GZ, gzipSync(json));
  const active = rows.filter((row) => row.isActive !== false).length;
  let manifest = {};
  try {
    if (existsSync(MANIFEST)) manifest = JSON.parse(readFileSync(MANIFEST, "utf8"));
  } catch {
    manifest = {};
  }
  writeFileSync(
    MANIFEST,
    `${JSON.stringify(
      {
        ...manifest,
        ...extraManifest,
        updatedAt: extraManifest.updatedAt || new Date().toISOString(),
        active,
        total: rows.length,
      },
      null,
      2,
    )}\n`,
  );
}

function remapYellowPages(rows) {
  let changed = 0;
  for (const row of rows) {
    const next = yellowPagesLayerFromTags(row.category, row.subcategory || row.category);
    if (row.mainCategory !== next) {
      row.mainCategory = next;
      changed += 1;
    } else if (!row.mainCategory) {
      row.mainCategory = next;
      changed += 1;
    }
    if (!row.subcategory) row.subcategory = row.category || "other";
  }
  return changed;
}

async function collectStores() {
  const stores = [];
  const errors = [];
  const stats = {
    familyMart: 0,
    sevenEleven: 0,
    cities: {},
  };
  for (const city of CITIES) {
    const towns = await townsForCity(city);
    const cityStat = { towns: towns.length, familyMart: 0, sevenEleven: 0 };
    stats.cities[city] = cityStat;
    console.log(`[chain] ${city} towns=${towns.length || "fallback-none"}`);
    if (!towns.length) {
      errors.push({ city, reason: "no-towns" });
      continue;
    }
    for (const town of towns) {
      try {
        const family = await familyStores(city, town);
        stores.push(...family);
        cityStat.familyMart += family.length;
        stats.familyMart += family.length;
      } catch (error) {
        errors.push({ city, town, brand: "FamilyMart", error: String(error) });
      }
      let seven = [];
      for (const variant of cityVariants(city)) {
        seven = await sevenElevenStores(variant, town);
        if (seven.length) break;
      }
      stores.push(...seven);
      cityStat.sevenEleven += seven.length;
      stats.sevenEleven += seven.length;
      writeFileSync(
        CHECKPOINT,
        `${JSON.stringify({ city, town, familyMart: stats.familyMart, sevenEleven: stats.sevenEleven }, null, 2)}\n`,
      );
    }
  }
  const unique = new Map();
  for (const store of stores) {
    if (!unique.has(store.sourceId)) unique.set(store.sourceId, store);
  }
  return { stores: [...unique.values()], stats, errors };
}

function mergeStores(rows, stores, now) {
  const grid = buildBrandGrid(rows);
  let updated = 0;
  let inserted = 0;
  for (const store of stores) {
    const match = findMatch(rows, grid, store);
    if (match >= 0) {
      const prev = rows[match];
      rows[match] = {
        ...prev,
        name: store.name || prev.name,
        nameNormalized: compact(store.name || prev.name),
        address: store.address || prev.address,
        addressNormalized: compact(store.address || prev.address),
        city: store.city || prev.city,
        county: store.city || prev.county,
        district: store.district || prev.district,
        latitude: store.latitude,
        longitude: store.longitude,
        brand: store.brand,
        branchName: splitBranch(store.name, store.brandLabel) || prev.branchName,
        category: "convenience",
        mainCategory: "food",
        subcategory: "convenience",
        confidence: Math.max(prev.confidence || 0, 0.96),
        isActive: true,
        updatedAt: now,
        lastSeenAt: now,
        sourceUpdatedAt: now,
        license: prev.source === "gov" ? "官方門市地圖" : prev.license,
      };
      updated += 1;
      continue;
    }
    const record = toRecord(store, now);
    rows.push(record);
    const key = `${record.brand}|${gridKey(record.latitude, record.longitude)}`;
    const bucket = grid.get(key);
    if (bucket) bucket.push(rows.length - 1);
    else grid.set(key, [rows.length - 1]);
    inserted += 1;
  }
  return { updated, inserted };
}

async function main() {
  const classifyOnly = process.argv.includes("--classify-only");
  const now = new Date().toISOString();
  const rows = loadIndex();
  if (!rows.length) {
    console.error("POI index missing");
    process.exit(1);
  }
  const remapped = remapYellowPages(rows);
  console.log(`[chain] remapped mainCategory ${remapped} / ${rows.length}`);

  let merge = { updated: 0, inserted: 0 };
  let collected = { stores: [], stats: {}, errors: [] };
  if (!classifyOnly) {
    collected = await collectStores();
    merge = mergeStores(rows, collected.stores, now);
    console.log(
      `[chain] official stores ${collected.stores.length} updated=${merge.updated} inserted=${merge.inserted}`,
    );
  }

  rows.sort((a, b) => String(a.name).localeCompare(String(b.name), "zh-Hant"));
  writeIndex(rows, {
    version: 4,
    chainsUpdatedAt: classifyOnly ? undefined : now,
    yellowPages: true,
    updatedAt: now,
  });

  const byBrand = {};
  for (const row of rows) {
    if (row.isActive === false) continue;
    if (row.brand === "7-Eleven" || row.brand === "FamilyMart") {
      byBrand[row.brand] = (byBrand[row.brand] ?? 0) + 1;
    }
  }
  const report = {
    dataset: "taiwan_poi_index",
    source: classifyOnly ? "yellow-pages-remap" : "official-chain-locators",
    brands: classifyOnly ? [] : ["7-Eleven", "FamilyMart"],
    remapped,
    fetched: collected.stores.length,
    updated: merge.updated,
    inserted: merge.inserted,
    errors: collected.errors,
    stats: collected.stats,
    byBrand,
    written: OUT,
    packed: GZ,
    updatedAt: now,
  };
  writeFileSync(REPORT, `${JSON.stringify(report, null, 2)}\n`);
  if (existsSync(CHECKPOINT)) {
    try {
      writeFileSync(CHECKPOINT, "");
    } catch {
      /* ignore */
    }
  }
  console.log(JSON.stringify({ remapped, ...merge, fetched: collected.stores.length, byBrand }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
