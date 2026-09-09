#!/usr/bin/env node
/**
 * Ingest nationwide storefronts from 經濟部商工行政資料開放平臺 CSVs
 * (政府資料開放授權條款第 1 版). 中華黃頁網站不爬；只用其食衣住行育樂分類。
 * 僅匯入核准設立且能配到門牌座標的店家（NLSC TextQueryMap + 既有 POI 地址）。
 *
 * 分批：GCIS_NLSC_LIMIT（預設 1000；可用 500 / 1000 / 2000 / 5000）
 * 續跑：src/data/gcis-ingest-checkpoint.json（禁止從 0 重掃已成功區間）
 * 失敗門牌會寫入 cache miss，除非 GCIS_RETRY_MISS=1
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync, appendFileSync } from "node:fs";
import { gunzipSync, gzipSync } from "node:zlib";
import {
  COUNTIES,
  cacheKey,
  cityFromAddress,
  classifyMatchQuality,
  compactKey,
  districtFromAddress,
  halfWidth,
  looksLikeStorefront,
  nlscQuery,
} from "./gcis-address.mjs";
import { brandFields } from "./gcis-brands.mjs";
import {
  advanceCheckpoint,
  beginJob,
  emptyCheckpoint,
  finishCheckpoint,
  newBatchRecord,
  sliceUnmatchedQueue,
} from "./gcis-checkpoint.mjs";
import { isNavReady, navEligibilityScore } from "./gcis-score.mjs";
import { industryFromTitle, STOREFRONT_INDUSTRIES } from "./gcis-yellow-pages.mjs";
import { yellowPagesLayerFromTags } from "./yellow-pages.mjs";
import {
  COUNTIES,
  cacheKey,
  cityFromAddress,
  classifyMatchQuality,
  compactKey,
  districtFromAddress,
  halfWidth,
  looksLikeStorefront,
  nlscQuery,
} from "./gcis-address.mjs";

const USER_AGENT = "NavPilot/0.1 (https://github.com/jin358-cmd/nav-map; POI ingest)";
const CATALOG_URL = "https://data.gcis.nat.gov.tw/od/datacategory";
const NLSC_MAP = "https://api.nlsc.gov.tw/idc/TextQueryMap";
const OUT = "src/data/taiwan-poi-index.json";
const GZ = "src/data/taiwan-poi-index.json.gz";
const MANIFEST = "src/data/poi-ingest-manifest.json";
const REPORT = "docs/gcis-company-ingest-report.json";
const REPORT_MD = "docs/gcis-company-ingest-report.md";
const FILE_MAP = "src/data/gcis-dataset-files.json";
const GEO_CACHE = "src/data/gcis-geocode-cache.json";
const CHECKPOINT = "src/data/gcis-ingest-checkpoint.json";
const BATCHES = "src/data/gcis-ingest-batches.json";
const REJECTS = "src/data/gcis-import-rejects.jsonl";
const CACHE_DIR = "/tmp/gcis-open-data";

const CITY_FILTER = (process.env.GCIS_CITY || "").replaceAll("台", "臺").trim();
const NLSC_LIMIT = Number(process.env.GCIS_NLSC_LIMIT ?? 1000);
const CONCURRENCY = Math.max(1, Number(process.env.GCIS_NLSC_CONCURRENCY ?? 4));
const DELAY_MS = Number(process.env.GCIS_NLSC_DELAY_MS ?? 60);
const RETRY_MISS = process.env.GCIS_RETRY_MISS === "1";

const ACTIVE_STATUS = /核准設立|核准認許|核准登記/;
const DEAD_STATUS = /解散|廢止|歇業|撤銷|停業|遷他縣市/;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
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
  const re = /href="\/od\/detail[^"]*\?oid=([0-9A-Fa-f-]{36})"[^>]*>([^<]+)</g;
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

async function geocodeNlscOnce(address, city) {
  const query = nlscQuery(address);
  if (query.length < 6) return { hit: null, httpError: false };
  const [lng, lat] = countyBias(city);
  const url = `${NLSC_MAP}/${encodeURIComponent(query)}/8/${lng}/${lat}`;
  const result = await fetchText(
    url,
    { Referer: "https://maps.nlsc.gov.tw/T09/", Accept: "application/xml" },
    8_000,
  );
  if (!result.ok) return { hit: null, httpError: true, status: result.status };
  const parsed = parseNlsc(result.text);
  if (!parsed) return { hit: null, httpError: false };
  return {
    hit: {
      lng: parsed.lng,
      lat: parsed.lat,
      kind: parsed.kind,
      label: parsed.content,
    },
    httpError: false,
  };
}

async function geocodeNlsc(address, city) {
  let retries = 0;
  let lastHttp = false;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const result = await geocodeNlscOnce(address, city);
      if (result.httpError) {
        lastHttp = true;
        retries += 1;
        await sleep(250 * (attempt + 1));
        continue;
      }
      return { ...result, retries };
    } catch {
      lastHttp = true;
      retries += 1;
      await sleep(250 * (attempt + 1));
    }
  }
  return { hit: null, httpError: lastHttp, retries };
}

function metersBetween(a, b) {
  const dLat = (a.latitude - b.latitude) * 111_320;
  const dLng =
    (a.longitude - b.longitude) * 111_320 * Math.cos((b.latitude * Math.PI) / 180);
  return Math.hypot(dLat, dLng);
}

function recordFromShop(shop, loc, now, extras = {}) {
  const city = cityFromAddress(shop.address);
  const district = districtFromAddress(shop.address, city || "");
  const subcategory = shop.subcategory || shop.category;
  const brands = brandFields(shop.name);
  const matchQuality =
    extras.matchQuality || classifyMatchQuality(shop.address, loc);
  const addressEntityCount = extras.addressEntityCount ?? 1;
  const osmMatched = Boolean(extras.osmMatched);
  const score = navEligibilityScore({
    registryType: shop.kind,
    address: shop.address,
    matchQuality,
    addressEntityCount,
    brand: brands.brand,
    osmMatched,
    industry: shop.industry,
    mainCategory: yellowPagesLayerFromTags(shop.category, subcategory),
    sourceUpdatedAt: shop.produced,
    hasPhone: Boolean(loc.phone || extras.phone),
  });
  const aliases = [...new Set([shop.taxId, ...brands.aliases].map((item) => compactKey(item)))];
  return {
    id: `gov-${shop.taxId}`,
    name: shop.name,
    nameNormalized: compactKey(shop.name),
    aliases,
    category: shop.category,
    subcategory,
    mainCategory: yellowPagesLayerFromTags(shop.category, subcategory),
    brand: brands.brand,
    branchName: brands.branchName,
    address: halfWidth(shop.address),
    addressNormalized: compactKey(shop.address),
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
    confidence:
      matchQuality === "A" ? 0.92 : matchQuality === "B" ? 0.86 : matchQuality === "C" ? 0.62 : 0.4,
    isActive: shop.isActive !== false,
    phone: loc.phone || extras.phone || null,
    hours: extras.hours || null,
    industry: shop.industry,
    registryType: shop.kind,
    matchQuality,
    navEligibilityScore: score,
    addressEntityCount,
    sourceStatus: shop.status || "核准設立",
    previousName: extras.previousName || undefined,
    previousAddress: extras.previousAddress || undefined,
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
  const meters = metersBetween(existing, row);
  if (meters > 45) return false;
  if (existing.nameNormalized === row.nameNormalized) return true;
  if (existing.addressNormalized && existing.addressNormalized === row.addressNormalized) {
    return true;
  }
  return false;
}

function reliableOsmMatch(osm, gcis) {
  if (osm.source === "gov") return false;
  const meters = metersBetween(osm, gcis);
  if (meters >= 30) return false;
  const nameMatch = osm.nameNormalized && osm.nameNormalized === gcis.nameNormalized;
  const addrMatch =
    osm.addressNormalized &&
    gcis.addressNormalized &&
    cacheKey(osm.address || "") === cacheKey(gcis.address || "");
  const brandOk = !osm.brand || !gcis.brand || osm.brand === gcis.brand;
  if (!brandOk) return false;
  if (nameMatch && (addrMatch || meters < 15)) return true;
  if (nameMatch && gcis.brand && osm.brand === gcis.brand) return true;
  return false;
}

function appendReject(row) {
  appendFileSync(REJECTS, `${JSON.stringify(row)}\n`);
}

function coverageEmpty() {
  const byCounty = {};
  for (const county of COUNTIES) {
    byCounty[county] = {
      rawCandidates: 0,
      addressMatched: 0,
      navReady: 0,
      active: 0,
      matchRate: 0,
      rejectRate: 0,
    };
  }
  byCounty["未知"] = {
    rawCandidates: 0,
    addressMatched: 0,
    navReady: 0,
    active: 0,
    matchRate: 0,
    rejectRate: 0,
  };
  const byCategory = {};
  for (const id of ["food", "clothing", "housing", "transport", "education", "leisure", "medical"]) {
    byCategory[id] = {
      sourceCount: 0,
      matchedCount: 0,
      navReadyCount: 0,
      activeCount: 0,
      avgConfidence: 0,
      avgNavEligibilityScore: 0,
      _conf: 0,
      _score: 0,
    };
  }
  return { byCounty, byCategory };
}

async function main() {
  mkdirSync(CACHE_DIR, { recursive: true });
  mkdirSync("docs", { recursive: true });
  const started = Date.now();
  const now = new Date().toISOString();
  const rejectsThisRun = [];
  const pushReject = (row) => {
    const record = { ...row, created_at: now, source: row.source || "gcis" };
    rejectsThisRun.push(record);
    appendReject(record);
  };

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
  const deadByTax = new Map();
  const datasetStats = [];
  let invalidStatus = 0;
  let noAddress = 0;

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
      const name = row["公司名稱"] || row["商業名稱"] || "";
      const address = row["公司地址"] || row["商業地址"] || "";
      const taxId = row["統一編號"] || "";
      if (!taxId) continue;
      if (DEAD_STATUS.test(status) || !ACTIVE_STATUS.test(status)) {
        invalidStatus += 1;
        if (DEAD_STATUS.test(status) && name) {
          deadByTax.set(taxId, {
            taxId,
            name: halfWidth(name),
            address: halfWidth(address),
            status,
            kind,
          });
        }
        continue;
      }
      if (!name) continue;
      if (!address) {
        noAddress += 1;
        pushReject({
          registry_id: taxId,
          name,
          address: "",
          reason: "no_address",
          raw_data: { status, industry: industry.title },
        });
        continue;
      }
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
        status,
        isActive: true,
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
  const list = [...unique.values()].sort((a, b) => a.taxId.localeCompare(b.taxId));
  console.log(`[gcis] unique active shops ${list.length}`);

  const addressCounts = new Map();
  for (const shop of list) {
    const key = cacheKey(shop.address);
    if (!key) continue;
    addressCounts.set(key, (addressCounts.get(key) ?? 0) + 1);
  }

  const existing = loadPoiRows();
  const existingGov = new Map();
  const byAddress = new Map();
  const osmGrid = new Map();
  for (const row of existing) {
    if (row.source === "gov") existingGov.set(String(row.sourceId), row);
    if (row.source !== "gov") pushGrid(osmGrid, row);
    const key = cacheKey(row.address || "");
    if (key.length >= 8) {
      const prev = byAddress.get(key);
      if (!prev || (row.phone && !prev.phone)) byAddress.set(key, row);
    }
  }

  const geoCache = loadJson(GEO_CACHE, {});
  const located = [];
  const needGeocode = [];
  let cacheHits = 0;
  let poiHits = 0;
  let invalidAddress = 0;

  for (const shop of list) {
    const addrKey = cacheKey(shop.address);
    if (!addrKey || addrKey.length < 6) {
      invalidAddress += 1;
      pushReject({
        registry_id: shop.taxId,
        name: shop.name,
        address: shop.address,
        reason: "invalid_address",
        raw_data: { kind: shop.kind },
      });
      continue;
    }
    const extras = {
      addressEntityCount: addressCounts.get(addrKey) ?? 1,
    };
    const prev = existingGov.get(shop.taxId);
    if (prev?.name && prev.name !== shop.name) extras.previousName = prev.name;
    if (prev?.address && prev.address !== shop.address) extras.previousAddress = prev.address;
    const cached = geoCache[addrKey];
    const poiHit = byAddress.get(addrKey);
    if (cached?.miss && !RETRY_MISS) continue;
    if (cached?.lat && cached?.lng) {
      cacheHits += 1;
      located.push(
        recordFromShop(shop, { ...cached, kind: cached.kind || "cache" }, now, extras),
      );
      continue;
    }
    if (poiHit) {
      poiHits += 1;
      const loc = {
        lat: poiHit.latitude,
        lng: poiHit.longitude,
        kind: "poi",
        phone: poiHit.phone || null,
        label: poiHit.address,
      };
      geoCache[addrKey] = loc;
      located.push(recordFromShop(shop, loc, now, extras));
      continue;
    }
    needGeocode.push(shop);
  }

  const unmatchedSorted = [...needGeocode].sort((a, b) => a.taxId.localeCompare(b.taxId));
  const sourceVersion = `gcis-catalog-${datasets.length}-files-${Object.keys(fileMap).length}`;
  const prevCheckpoint = loadJson(CHECKPOINT, emptyCheckpoint());
  const job = beginJob(prevCheckpoint, sourceVersion, now);
  const slice = sliceUnmatchedQueue(unmatchedSorted, job, NLSC_LIMIT);
  const queued = slice.batch;
  console.log(
    `[gcis] geocode ${queued.length} / unmatched ${unmatchedSorted.length} resume offset=${slice.start_offset} lastId=${job.last_successful_registry_id || "-"}`,
  );

  writeFileSync(CHECKPOINT, `${JSON.stringify(job, null, 2)}\n`);

  let geocoded = 0;
  let geoFail = 0;
  let nlscRequests = 0;
  let nlscErrors = 0;
  let retryCount = 0;
  const batchT0 = Date.now();
  if (NLSC_LIMIT !== 0 && queued.length) {
    await mapPool(queued, CONCURRENCY, async (shop) => {
      const addrKey = cacheKey(shop.address);
      const extras = { addressEntityCount: addressCounts.get(addrKey) ?? 1 };
      const prev = existingGov.get(shop.taxId);
      if (prev?.name && prev.name !== shop.name) extras.previousName = prev.name;
      if (prev?.address && prev.address !== shop.address) extras.previousAddress = prev.address;
      try {
        nlscRequests += 1;
        const result = await geocodeNlsc(shop.address, shop.city);
        retryCount += result.retries || 0;
        await sleep(DELAY_MS);
        if (result.httpError) nlscErrors += 1;
        if (!result.hit) {
          geoFail += 1;
          geoCache[addrKey] = { miss: true, at: now };
          pushReject({
            registry_id: shop.taxId,
            name: shop.name,
            address: shop.address,
            reason: result.httpError ? "no_coordinate" : "no_coordinate",
            raw_data: { httpError: Boolean(result.httpError), query: nlscQuery(shop.address) },
          });
          return;
        }
        if (result.hit.lng < 118 || result.hit.lng > 123 || result.hit.lat < 20 || result.hit.lat > 27) {
          geoFail += 1;
          geoCache[addrKey] = { miss: true, at: now, reason: "out_of_taiwan" };
          pushReject({
            registry_id: shop.taxId,
            name: shop.name,
            address: shop.address,
            reason: "out_of_taiwan",
            raw_data: result.hit,
          });
          return;
        }
        const quality = classifyMatchQuality(shop.address, result.hit);
        geoCache[addrKey] = { ...result.hit, quality };
        if (quality === "D" || quality === "E") {
          geoFail += 1;
          pushReject({
            registry_id: shop.taxId,
            name: shop.name,
            address: shop.address,
            reason: quality === "E" ? "no_coordinate" : "low_nav_score",
            raw_data: { quality, hit: result.hit },
          });
          return;
        }
        located.push(recordFromShop(shop, result.hit, now, { ...extras, matchQuality: quality }));
        geocoded += 1;
        if (geocoded % 100 === 0) {
          writeFileSync(GEO_CACHE, `${JSON.stringify(geoCache)}\n`);
          console.log(`[gcis] geocoded ${geocoded} fail ${geoFail}`);
        }
      } catch (error) {
        geoFail += 1;
        nlscErrors += 1;
        pushReject({
          registry_id: shop.taxId,
          name: shop.name,
          address: shop.address,
          reason: "no_coordinate",
          raw_data: { error: error instanceof Error ? error.message : String(error) },
        });
      }
    });
  }
  writeFileSync(GEO_CACHE, `${JSON.stringify(geoCache)}\n`);

  const lastTaxId = queued.length ? queued[queued.length - 1].taxId : job.last_successful_registry_id;
  const advanced = queued.length
    ? advanceCheckpoint(job, slice, lastTaxId, new Date().toISOString())
    : { ...job, updated_at: new Date().toISOString() };
  const finished = finishCheckpoint(advanced, "completed");
  writeFileSync(CHECKPOINT, `${JSON.stringify(finished, null, 2)}\n`);

  const batchRecord = newBatchRecord({
    job: finished,
    slice,
    stats: {
      matched: geocoded,
      unmatched: geoFail,
      skipped: 0,
      failed: nlscErrors,
    },
    durationMs: Date.now() - batchT0,
    retryCount,
  });
  const prevBatches = loadJson(BATCHES, []);
  const batchList = Array.isArray(prevBatches) ? prevBatches : [];
  batchList.push(batchRecord);
  writeFileSync(BATCHES, `${JSON.stringify(batchList.slice(-200), null, 2)}\n`);

  const incomingById = new Map();
  for (const row of located) incomingById.set(row.sourceId, row);

  for (const row of existing) {
    if (row.source !== "gov") continue;
    const dead = deadByTax.get(row.sourceId);
    if (dead) {
      incomingById.set(row.sourceId, {
        ...row,
        isActive: false,
        lastSeenAt: now,
        sourceStatus: dead.status,
        previousName: row.name !== dead.name ? row.name : row.previousName,
        previousAddress: row.address !== dead.address ? row.address : row.previousAddress,
        name: dead.name || row.name,
        address: dead.address || row.address,
      });
      continue;
    }
    if (!incomingById.has(row.sourceId) && looksLikeStorefront(row.registryType || "company", row.address || "")) {
      incomingById.set(row.sourceId, { ...row, lastSeenAt: now });
    }
  }

  const incoming = [...incomingById.values()];

  const keptExisting = existing.filter((row) => row.source !== "gov");
  const grid = new Map();
  for (const row of keptExisting) pushGrid(grid, row);
  const merged = [...keptExisting];
  let inserted = 0;
  let skippedDup = 0;
  let osmMerged = 0;
  let phonesFilled = 0;
  let clusterDownranked = 0;
  const inactiveKept = [];

  for (const row of incoming) {
    if (row.isActive === false) {
      merged.push(row);
      inactiveKept.push(row);
      continue;
    }
    if ((row.addressEntityCount ?? 1) >= 20) clusterDownranked += 1;

    const twin = nearbyRows(osmGrid, row).find((prev) => reliableOsmMatch(prev, row));
    if (twin) {
      osmMerged += 1;
      if (!row.phone && twin.phone) {
        row.phone = twin.phone;
        phonesFilled += 1;
      }
      if (!row.hours && twin.hours) row.hours = twin.hours;
      if (!row.brand && twin.brand) row.brand = twin.brand;
      if (!row.branchName && twin.branchName) row.branchName = twin.branchName;
      if (twin.category && row.category === "other") row.category = twin.category;
      const idx = merged.findIndex((item) => item.id === twin.id);
      if (idx >= 0 && !merged[idx].phone && row.phone) {
        merged[idx] = { ...merged[idx], phone: row.phone };
      }
    }

    if (nearbyRows(grid, row).some((prev) => tooClose(prev, row))) {
      skippedDup += 1;
      pushReject({
        registry_id: row.sourceId,
        name: row.name,
        address: row.address,
        reason: "duplicate",
        raw_data: { matchQuality: row.matchQuality },
      });
      continue;
    }
    merged.push(row);
    pushGrid(grid, row);
    inserted += 1;
  }

  const active = merged.filter((row) => row.isActive !== false);
  writeFileSync(GZ, gzipSync(JSON.stringify(merged)));

  const coverage = coverageEmpty();
  for (const shop of list) {
    const city = shop.city || "未知";
    if (!coverage.byCounty[city]) {
      coverage.byCounty[city] = {
        rawCandidates: 0,
        addressMatched: 0,
        navReady: 0,
        active: 0,
        matchRate: 0,
        rejectRate: 0,
      };
    }
    coverage.byCounty[city].rawCandidates += 1;
    const layer = yellowPagesLayerFromTags(shop.category, shop.subcategory);
    coverage.byCategory[layer].sourceCount += 1;
  }

  const govActive = merged.filter((row) => row.source === "gov");
  let scoreSum = 0;
  let scoreN = 0;
  let companyN = 0;
  let businessN = 0;
  let navReadyN = 0;
  let withPhone = 0;
  const byCategory = {};
  const byMain = {};
  const byCityCount = {};
  const qualityCounts = { A: 0, B: 0, C: 0, D: 0, E: 0 };

  for (const row of govActive) {
    if (row.phone) withPhone += 1;
    if (row.registryType === "business") businessN += 1;
    else companyN += 1;
    const q = row.matchQuality || "B";
    qualityCounts[q] = (qualityCounts[q] ?? 0) + 1;
    if (typeof row.navEligibilityScore === "number") {
      scoreSum += row.navEligibilityScore;
      scoreN += 1;
    }
    const navReady = isNavReady(row.matchQuality || "B", row.navEligibilityScore ?? 0) && row.isActive !== false;
    if (navReady) navReadyN += 1;
    byCategory[row.category] = (byCategory[row.category] ?? 0) + 1;
    byMain[row.mainCategory] = (byMain[row.mainCategory] ?? 0) + 1;
    byCityCount[row.city || "未知"] = (byCityCount[row.city || "未知"] ?? 0) + 1;

    const city = row.city || "未知";
    if (!coverage.byCounty[city]) {
      coverage.byCounty[city] = {
        rawCandidates: 0,
        addressMatched: 0,
        navReady: 0,
        active: 0,
        matchRate: 0,
        rejectRate: 0,
      };
    }
    if (row.isActive !== false) {
      coverage.byCounty[city].addressMatched += 1;
      coverage.byCounty[city].active += 1;
      if (navReady) coverage.byCounty[city].navReady += 1;
    }
    const layer = row.mainCategory;
    if (coverage.byCategory[layer]) {
      if (row.isActive !== false) {
        coverage.byCategory[layer].matchedCount += 1;
        coverage.byCategory[layer].activeCount += 1;
        coverage.byCategory[layer]._conf += row.confidence || 0;
        coverage.byCategory[layer]._score += row.navEligibilityScore || 0;
        if (navReady) coverage.byCategory[layer].navReadyCount += 1;
      }
    }
  }

  for (const city of Object.keys(coverage.byCounty)) {
    const row = coverage.byCounty[city];
    row.matchRate = row.rawCandidates ? Number((row.addressMatched / row.rawCandidates).toFixed(4)) : 0;
    row.rejectRate = row.rawCandidates
      ? Number(((row.rawCandidates - row.addressMatched) / row.rawCandidates).toFixed(4))
      : 0;
  }
  for (const id of Object.keys(coverage.byCategory)) {
    const row = coverage.byCategory[id];
    row.avgConfidence = row.matchedCount ? Number((row._conf / row.matchedCount).toFixed(3)) : 0;
    row.avgNavEligibilityScore = row.matchedCount
      ? Number((row._score / row.matchedCount).toFixed(2))
      : 0;
    delete row._conf;
    delete row._score;
  }

  const unmatchedLeft = Math.max(0, unmatchedSorted.length - queued.length);
  const locatedActive = govActive.filter((row) => row.isActive !== false).length;
  const avgScore = scoreN ? Number((scoreSum / scoreN).toFixed(2)) : 0;

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
        gcisImported: locatedActive,
        gcisNavReady: navReadyN,
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
    batchSize: NLSC_LIMIT,
    fetchedShops: list.length,
    geocoded,
    geoFail,
    cacheHits,
    poiHits,
    unmatchedLeft,
    located: locatedActive,
    inserted,
    skippedDup,
    withPhone,
    phonesFilled,
    osmMerged,
    clusterDownranked,
    inactiveKept: inactiveKept.length,
    invalidStatus,
    noAddress,
    invalidAddress,
    rejected: rejectsThisRun.length,
    navReady: navReadyN,
    avgNavEligibilityScore: avgScore,
    registryMix: { company: companyN, business: businessN },
    matchQuality: qualityCounts,
    nlscRequests,
    nlscErrors,
    nlscErrorRate: nlscRequests ? Number((nlscErrors / nlscRequests).toFixed(4)) : 0,
    retryCount,
    checkpoint: {
      job_id: finished.job_id,
      batch_id: finished.batch_id,
      last_successful_offset: finished.last_successful_offset,
      last_successful_registry_id: finished.last_successful_registry_id,
      status: finished.status,
    },
    durationMs: Date.now() - started,
    datasets: datasetStats,
    byCategory,
    byYellowPages: byMain,
    byCity: byCityCount,
    byCounty: coverage.byCounty,
    byMainCategory: coverage.byCategory,
    written: OUT,
  };
  writeFileSync(REPORT, `${JSON.stringify(report, null, 2)}\n`);

  const md = [
    "# GCIS company-registry ingest report",
    "",
    `- 時間：${now}`,
    `- job：\`${finished.job_id}\` batch ${finished.batch_id}`,
    `- checkpoint offset：${finished.last_successful_offset} / last id ${finished.last_successful_registry_id || "-"}`,
    `- raw candidates：${list.length}`,
    `- 本輪 NLSC 新配對：${geocoded}`,
    `- matched 入庫（gov active）：${locatedActive}`,
    `- nav-ready：${navReadyN}`,
    `- unmatched left：${unmatchedLeft}`,
    `- rejected（本輪）：${rejectsThisRun.length}`,
    `- company / business：${companyN} / ${businessN}`,
    `- avg nav_eligibility_score：${avgScore}`,
    `- 多公司同址降權：${clusterDownranked}`,
    `- OSM merge：${osmMerged}`,
    `- phone 補入：${phonesFilled}`,
    `- NLSC requests / errors：${nlscRequests} / ${nlscErrors} (${report.nlscErrorRate})`,
    `- duration：${report.durationMs} ms`,
    "",
    "## 縣市 match rate",
    "",
    "| 縣市 | candidates | matched | nav-ready | match rate |",
    "| --- | ---: | ---: | ---: | ---: |",
    ...COUNTIES.map((city) => {
      const row = coverage.byCounty[city];
      return `| ${city} | ${row.rawCandidates} | ${row.addressMatched} | ${row.navReady} | ${(row.matchRate * 100).toFixed(2)}% |`;
    }),
    "",
    "## 七大分類",
    "",
    "| 分類 | source | matched | nav-ready | avg score |",
    "| --- | ---: | ---: | ---: | ---: |",
    ...Object.entries(coverage.byCategory).map(
      ([id, row]) =>
        `| ${id} | ${row.sourceCount} | ${row.matchedCount} | ${row.navReadyCount} | ${row.avgNavEligibilityScore} |`,
    ),
    "",
  ].join("\n");
  writeFileSync(REPORT_MD, `${md}\n`);

  console.log(
    JSON.stringify(
      {
        unique: list.length,
        located: locatedActive,
        inserted,
        geocoded,
        geoFail,
        navReady: navReadyN,
        unmatchedLeft,
        checkpoint: finished.last_successful_offset,
        lastId: finished.last_successful_registry_id,
        active: active.length,
        durationMs: report.durationMs,
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  try {
    const prev = loadJson(CHECKPOINT, emptyCheckpoint());
    writeFileSync(
      CHECKPOINT,
      `${JSON.stringify(finishCheckpoint(prev, "failed", error instanceof Error ? error.message : String(error)), null, 2)}\n`,
    );
  } catch {
    /* ignore */
  }
  console.error(error);
  process.exit(1);
});
