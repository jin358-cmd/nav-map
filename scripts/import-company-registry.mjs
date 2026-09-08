#!/usr/bin/env node
/**
 * Ingest nationwide storefronts from 經濟部商工行政資料開放平臺 CSVs
 * (政府資料開放授權條款第 1 版). 中華黃頁網站不爬；只用其食衣住行育樂分類。
 * 僅匯入核准設立且能配到門牌座標的店家（NLSC TextQueryMap + 既有 POI 地址）。
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { gunzipSync, gzipSync } from "node:zlib";
import { industryFromTitle, STOREFRONT_INDUSTRIES } from "./gcis-yellow-pages.mjs";
import { yellowPagesLayerFromTags } from "./yellow-pages.mjs";

const USER_AGENT = "NavPilot/0.1 (https://github.com/jin358-cmd/nav-map; POI ingest)";
const CATALOG_URL = "https://data.gcis.nat.gov.tw/od/datacategory";
const NLSC_MAP = "https://api.nlsc.gov.tw/idc/TextQueryMap";
const OUT = "src/data/taiwan-poi-index.json";
const GZ = "src/data/taiwan-poi-index.json.gz";
const MANIFEST = "src/data/poi-ingest-manifest.json";
const REPORT = "docs/gcis-company-ingest-report.json";
const FILE_MAP = "src/data/gcis-dataset-files.json";
const GEO_CACHE = "src/data/gcis-geocode-cache.json";
const CACHE_DIR = "/tmp/gcis-open-data";

const CITY_FILTER = (process.env.GCIS_CITY || "").replaceAll("台", "臺").trim();
const NLSC_LIMIT = Number(process.env.GCIS_NLSC_LIMIT ?? 4000);
const CONCURRENCY = Math.max(1, Number(process.env.GCIS_NLSC_CONCURRENCY ?? 5));
const DELAY_MS = Number(process.env.GCIS_NLSC_DELAY_MS ?? 40);

const ACTIVE_STATUS = /核准設立|核准認許|核准登記/;
const DEAD_STATUS = /解散|廢止|歇業|撤銷|停業|遷他縣市/;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function compact(value) {
  return String(value ?? "")
    .replace(/[０-９]/g, (digit) => String.fromCharCode(digit.charCodeAt(0) - 0xfee0))
    .replace(/[Ｏ○〇]/g, "0")
    .toLowerCase()
    .replaceAll("臺", "台")
    .replace(/[（）()]/g, "")
    .replace(/[\s\-_.＋+]/g, "");
}

function halfWidth(value) {
  return String(value ?? "").replace(/[０-９]/g, (digit) =>
    String.fromCharCode(digit.charCodeAt(0) - 0xfee0),
  );
}

function stripFloor(address) {
  return halfWidth(address)
    .replace(/\s+/g, "")
    .replace(/(?:地下|B)?\d+(?:樓|F|f|層).*$/u, "")
    .replace(/\d+室.*$/u, "")
    .replace(/[（(][^)）]*[)）]/g, "")
    .replace(/里/g, "里")
    .trim();
}

function geocodeQuery(address) {
  let next = stripFloor(address);
  next = next.replace(/[\u4e00-\u9fff]{1,4}里(?:\d+鄰)?/u, "");
  next = next.replace(/\d+鄰/u, "");
  return next.replaceAll("台", "臺");
}

function cityFromAddress(address) {
  const match = halfWidth(address).match(
    /(臺北市|台北市|新北市|桃園市|臺中市|台中市|臺南市|台南市|高雄市|基隆市|新竹市|新竹縣|苗栗縣|彰化縣|南投縣|雲林縣|嘉義市|嘉義縣|屏東縣|宜蘭縣|花蓮縣|臺東縣|台東縣|澎湖縣|金門縣|連江縣)/,
  );
  return match?.[1]?.replaceAll("台", "臺") ?? null;
}

function looksLikeStorefront(kind, address) {
  const text = halfWidth(address);
  if (kind === "business") return true;
  if (/地下|[Bb]\d|(?:^|[^\d])(?:1樓|一樓|2樓|二樓)/.test(text)) return true;
  if (!/樓/.test(text)) return true;
  return false;
}

function districtFromAddress(address, city) {
  const text = halfWidth(address);
  const rest = city && text.includes(city) ? text.slice(text.indexOf(city) + city.length) : text;
  return rest.match(/^(.{1,4}[鄉鎮市區])/u)?.[1] ?? null;
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;
  const src = text.replace(/^\uFEFF/, "");
  for (let i = 0; i < src.length; i += 1) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          cell += '"';
          i += 1;
        } else quoted = false;
      } else cell += ch;
      continue;
    }
    if (ch === '"') {
      quoted = true;
      continue;
    }
    if (ch === ",") {
      row.push(cell);
      cell = "";
      continue;
    }
    if (ch === "\n") {
      row.push(cell);
      if (row.some((item) => item.trim())) rows.push(row);
      row = [];
      cell = "";
      continue;
    }
    if (ch !== "\r") cell += ch;
  }
  if (cell || row.length) {
    row.push(cell);
    rows.push(row);
  }
  if (!rows.length) return [];
  const headers = rows[0].map((item) => item.trim());
  return rows.slice(1).map((values) => {
    const record = {};
    headers.forEach((key, index) => {
      record[key] = (values[index] ?? "").trim();
    });
    return record;
  });
}

async function fetchText(url, headers = {}, timeoutMs = 45_000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      headers: { "User-Agent": USER_AGENT, ...headers },
      signal: controller.signal,
      redirect: "follow",
    });
    const text = await response.text();
    return { ok: response.ok, status: response.status, text };
  } finally {
    clearTimeout(timer);
  }
}

function loadJson(path, fallback) {
  if (!existsSync(path)) return fallback;
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return fallback;
  }
}

function loadPoiRows() {
  if (existsSync(GZ)) {
    return JSON.parse(gunzipSync(readFileSync(GZ)).toString("utf8"));
  }
  if (existsSync(OUT)) return JSON.parse(readFileSync(OUT, "utf8"));
  return [];
}

function parseCatalog(html) {
  const items = [];
  const re =
    /href="\/od\/detail[^"]*\?oid=([0-9A-Fa-f-]{36})"[^>]*>([^<]+)</g;
  let match = re.exec(html);
  while (match) {
    items.push({ oid: match[1], title: match[2].trim() });
    match = re.exec(html);
  }
  return items;
}

async function fileOidForDataset(detailOid) {
  const result = await fetchText(`https://data.gcis.nat.gov.tw/od/detail?oid=${detailOid}`);
  const found = result.text.match(/showDialog\('(\/od\/file\?oid=[0-9A-Fa-f-]+)'\)/);
  return found ? found[1] : null;
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

function countyBias(city) {
  const map = {
    臺北市: [121.56, 25.04],
    新北市: [121.46, 25.01],
    桃園市: [121.3, 24.99],
    臺中市: [120.67, 24.15],
    臺南市: [120.2, 22.99],
    高雄市: [120.31, 22.62],
    基隆市: [121.74, 25.13],
    新竹市: [120.97, 24.8],
    嘉義市: [120.45, 23.48],
  };
  return map[city] || [120.96, 23.7];
}

function parseNlsc(xml) {
  const items = [...xml.matchAll(/<ITEM>([\s\S]*?)<\/ITEM>/gi)];
  const hits = [];
  for (const item of items) {
    const block = item[1];
    const content = block.match(/<CONTENT>([\s\S]*?)<\/CONTENT>/i)?.[1]?.trim() || "";
    const key = block.match(/<KEY>([\s\S]*?)<\/KEY>/i)?.[1] || "";
    const loc = block.match(/<LOCATION>([\s\S]*?)<\/LOCATION>/i)?.[1] || "";
    const [lngRaw, latRaw] = loc.split(",");
    const lng = Number(lngRaw);
    const lat = Number(latRaw);
    if (!Number.isFinite(lng) || !Number.isFinite(lat)) continue;
    if (lng < 118 || lng > 123 || lat < 20 || lat > 27) continue;
    const kind = key.includes(",ADDRESS,")
      ? "ADDRESS"
      : key.includes(",CROSSROAD,")
        ? "CROSSROAD"
        : "other";
    hits.push({ content, kind, lng, lat });
  }
  hits.sort((a, b) => Number(b.kind === "ADDRESS") - Number(a.kind === "ADDRESS"));
  return hits[0] || null;
}

async function geocodeNlsc(address, city) {
  const query = geocodeQuery(address);
  if (query.length < 6) return null;
  const [lng, lat] = countyBias(city);
  const url = `${NLSC_MAP}/${encodeURIComponent(query)}/8/${lng}/${lat}`;
  const result = await fetchText(
    url,
    { Referer: "https://maps.nlsc.gov.tw/T09/", Accept: "application/xml" },
    6_000,
  );
  if (!result.ok) return null;
  const hit = parseNlsc(result.text);
  if (!hit) return null;
  return {
    lng: hit.lng,
    lat: hit.lat,
    kind: hit.kind,
    label: hit.content,
  };
}

function recordFromShop(shop, loc, now) {
  const city = cityFromAddress(shop.address);
  const district = districtFromAddress(shop.address, city || "");
  const subcategory = shop.subcategory || shop.category;
  return {
    id: `gov-${shop.taxId}`,
    name: shop.name,
    nameNormalized: compact(shop.name),
    aliases: [shop.taxId],
    category: shop.category,
    subcategory,
    mainCategory: yellowPagesLayerFromTags(shop.category, subcategory),
    brand: null,
    branchName: null,
    address: halfWidth(shop.address),
    addressNormalized: compact(shop.address),
    city,
    county: city,
    district,
    latitude: loc.lat,
    longitude: loc.lng,
    source: "gov",
    sourceId: shop.taxId,
    updatedAt: now,
    lastSeenAt: now,
    sourceUpdatedAt: shop.produced || now,
    license: "OGDL-Taiwan-1.0",
    confidence: loc.kind === "ADDRESS" ? 0.9 : loc.kind === "poi" ? 0.86 : 0.72,
    isActive: true,
    phone: loc.phone || null,
    industry: shop.industry,
  };
}

function cellKey(lat, lng) {
  return `${lat.toFixed(3)}|${lng.toFixed(3)}`;
}

function pushGrid(grid, row) {
  const key = cellKey(row.latitude, row.longitude);
  const bucket = grid.get(key);
  if (bucket) bucket.push(row);
  else grid.set(key, [row]);
}

function nearbyRows(grid, row) {
  const lat0 = Number(row.latitude.toFixed(3));
  const lng0 = Number(row.longitude.toFixed(3));
  const found = [];
  for (let dLat = -1; dLat <= 1; dLat += 1) {
    for (let dLng = -1; dLng <= 1; dLng += 1) {
      const bucket = grid.get(
        `${(lat0 + dLat * 0.001).toFixed(3)}|${(lng0 + dLng * 0.001).toFixed(3)}`,
      );
      if (bucket) found.push(...bucket);
    }
  }
  return found;
}

function tooClose(existing, row) {
  const dLat = (existing.latitude - row.latitude) * 111_320;
  const dLng =
    (existing.longitude - row.longitude) *
    111_320 *
    Math.cos((row.latitude * Math.PI) / 180);
  const meters = Math.hypot(dLat, dLng);
  if (meters > 45) return false;
  if (existing.nameNormalized === row.nameNormalized) return true;
  if (existing.addressNormalized && existing.addressNormalized === row.addressNormalized) {
    return true;
  }
  return false;
}

async function main() {
  mkdirSync(CACHE_DIR, { recursive: true });
  const started = Date.now();
  const now = new Date().toISOString();
  console.log("[gcis] fetch catalog");
  const catalogPage = await fetchText(CATALOG_URL);
  if (!catalogPage.ok) throw new Error(`catalog HTTP ${catalogPage.status}`);
  const catalog = parseCatalog(catalogPage.text);
  const wantedTitles = new Set(STOREFRONT_INDUSTRIES.map((item) => item.title));
  const datasets = catalog.filter((item) => {
    const mapped = industryFromTitle(item.title);
    return mapped && wantedTitles.has(mapped.title);
  });
  const fileMap = loadJson(FILE_MAP, {});
  const shops = [];
  const datasetStats = [];

  for (const dataset of datasets) {
    const kind = dataset.title.startsWith("商業") ? "business" : "company";
    const industry = industryFromTitle(dataset.title);
    if (!industry) continue;
    if (!fileMap[dataset.oid]) {
      const path = await fileOidForDataset(dataset.oid);
      await sleep(80);
      if (!path) {
        datasetStats.push({ title: dataset.title, skipped: "no-file" });
        continue;
      }
      fileMap[dataset.oid] = path;
      writeFileSync(FILE_MAP, `${JSON.stringify(fileMap, null, 2)}\n`);
    }
    const filePath = fileMap[dataset.oid];
    const cacheFile = `${CACHE_DIR}/${dataset.oid}.csv`;
    if (!existsSync(cacheFile)) {
      console.log(`[gcis] download ${dataset.title}`);
      const csv = await fetchText(`https://data.gcis.nat.gov.tw${filePath}`, {}, 120_000);
      if (!csv.ok) {
        datasetStats.push({ title: dataset.title, skipped: `http-${csv.status}` });
        continue;
      }
      writeFileSync(cacheFile, csv.text);
    }
    const rows = parseCsv(readFileSync(cacheFile, "utf8"));
    let kept = 0;
    for (const row of rows) {
      const status = row["公司狀態"] || row["登記狀態"] || "";
      if (DEAD_STATUS.test(status) || !ACTIVE_STATUS.test(status)) continue;
      const name = row["公司名稱"] || row["商業名稱"] || "";
      const address = row["公司地址"] || row["商業地址"] || "";
      const taxId = row["統一編號"] || "";
      if (!name || !address || !taxId) continue;
      const city = cityFromAddress(address);
      if (CITY_FILTER && city !== CITY_FILTER) continue;
      if (!looksLikeStorefront(kind, address)) continue;
      shops.push({
        taxId,
        name: halfWidth(name),
        address: halfWidth(address),
        kind,
        industry: industry.title,
        category: industry.category,
        subcategory: industry.subcategory,
        produced: row["產製日期"] || "",
        city,
      });
      kept += 1;
    }
    datasetStats.push({ title: dataset.title, rows: rows.length, active: kept });
    console.log(`[gcis] ${dataset.title} rows=${rows.length} active=${kept}`);
  }

  const unique = new Map();
  for (const shop of shops) {
    const prev = unique.get(shop.taxId);
    if (!prev) {
      unique.set(shop.taxId, shop);
      continue;
    }
    const rank = (item) =>
      (item.category === "restaurant" ? 3 : 0) + (item.kind === "business" ? 1 : 0);
    if (rank(shop) > rank(prev)) unique.set(shop.taxId, shop);
  }
  const list = [...unique.values()];
  console.log(`[gcis] unique active shops ${list.length}`);

  const existing = loadPoiRows();
  const byAddress = new Map();
  for (const row of existing) {
    const key = compact(stripFloor(row.address || ""));
    if (key.length >= 8) {
      const prev = byAddress.get(key);
      if (!prev || (row.phone && !prev.phone)) byAddress.set(key, row);
    }
  }

  const geoCache = loadJson(GEO_CACHE, {});
  const located = [];
  const needGeocode = [];
  for (const shop of list) {
    const addrKey = compact(stripFloor(shop.address));
    const cached = geoCache[addrKey];
    const poiHit = byAddress.get(addrKey);
    if (cached?.lat && cached?.lng) {
      located.push(
        recordFromShop(shop, { ...cached, kind: cached.kind || "cache" }, now),
      );
      continue;
    }
    if (poiHit) {
      const loc = {
        lat: poiHit.latitude,
        lng: poiHit.longitude,
        kind: "poi",
        phone: poiHit.phone || null,
      };
      geoCache[addrKey] = loc;
      located.push(recordFromShop(shop, loc, now));
      continue;
    }
    needGeocode.push(shop);
  }

  const byCity = new Map();
  for (const shop of needGeocode) {
    const city = shop.city || "未知";
    if (!byCity.has(city)) byCity.set(city, []);
    byCity.get(city).push(shop);
  }
  const queued = [];
  if (NLSC_LIMIT !== 0) {
    let more = true;
    while (more) {
      more = false;
      for (const rows of byCity.values()) {
        if (!rows.length) continue;
        queued.push(rows.shift());
        more = true;
        if (NLSC_LIMIT > 0 && queued.length >= NLSC_LIMIT) {
          more = false;
          break;
        }
      }
    }
  }
  console.log(`[gcis] geocode ${queued.length} / unmatched ${needGeocode.length}`);

  let geocoded = 0;
  let geoFail = 0;
  if (NLSC_LIMIT !== 0) {
    await mapPool(queued, CONCURRENCY, async (shop) => {
    const addrKey = compact(stripFloor(shop.address));
    try {
      const hit = await geocodeNlsc(shop.address, shop.city);
      await sleep(DELAY_MS);
      if (!hit) {
        geoFail += 1;
        return;
      }
      geoCache[addrKey] = hit;
      located.push(recordFromShop(shop, hit, now));
      geocoded += 1;
      if (geocoded % 200 === 0) {
        writeFileSync(GEO_CACHE, `${JSON.stringify(geoCache)}\n`);
        console.log(`[gcis] geocoded ${geocoded} fail ${geoFail}`);
      }
    } catch {
      geoFail += 1;
    }
  });
  }
  writeFileSync(GEO_CACHE, `${JSON.stringify(geoCache)}\n`);

  const incomingById = new Map();
  for (const row of located) incomingById.set(row.sourceId, row);
  for (const row of existing) {
    if (row.source === "gov" && !incomingById.has(row.sourceId)) {
      if (looksLikeStorefront("company", row.address || "")) {
        incomingById.set(row.sourceId, row);
      }
    }
  }
  const incoming = [...incomingById.values()];

  const keptExisting = existing.filter((row) => row.source !== "gov");
  const grid = new Map();
  for (const row of keptExisting) pushGrid(grid, row);
  const merged = [...keptExisting];
  let inserted = 0;
  let skippedDup = 0;
  for (const row of incoming) {
    if (nearbyRows(grid, row).some((prev) => tooClose(prev, row))) {
      skippedDup += 1;
      continue;
    }
    merged.push(row);
    pushGrid(grid, row);
    inserted += 1;
  }

  const active = merged.filter((row) => row.isActive !== false);
  writeFileSync(GZ, gzipSync(JSON.stringify(merged)));

  const byCategory = {};
  const byMain = {};
  const byCityCount = {};
  let withPhone = 0;
  for (const row of incoming) {
    byCategory[row.category] = (byCategory[row.category] ?? 0) + 1;
    byMain[row.mainCategory] = (byMain[row.mainCategory] ?? 0) + 1;
    byCityCount[row.city || "未知"] = (byCityCount[row.city || "未知"] ?? 0) + 1;
    if (row.phone) withPhone += 1;
  }

  const manifest = loadJson(MANIFEST, {});
  writeFileSync(
    MANIFEST,
    `${JSON.stringify(
      {
        ...manifest,
        updatedAt: now,
        active: active.length,
        total: merged.length,
        gcisUpdatedAt: now,
        gcisImported: incoming.length,
      },
      null,
      2,
    )}\n`,
  );

  const report = {
    dataset: "MOEA GCIS company / business registration (storefront industries)",
    license: "OGDL-Taiwan-1.0",
    yellowPages: "classification only; Chunghwa Yellow Pages website not scraped",
    geocoder: "NLSC TextQueryMap + existing POI address match",
    status: "IMPORTED",
    cityFilter: CITY_FILTER || null,
    fetchedShops: list.length,
    geocoded,
    geoFail,
    unmatchedLeft: Math.max(0, needGeocode.length - queued.length),
    located: incoming.length,
    inserted,
    skippedDup,
    withPhone,
    durationMs: Date.now() - started,
    datasets: datasetStats,
    byCategory,
    byYellowPages: byMain,
    byCity: byCityCount,
    written: OUT,
  };
  writeFileSync(REPORT, `${JSON.stringify(report, null, 2)}\n`);
  console.log(
    JSON.stringify(
      {
        unique: list.length,
        located: incoming.length,
        inserted,
        geocoded,
        geoFail,
        active: active.length,
        durationMs: report.durationMs,
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
