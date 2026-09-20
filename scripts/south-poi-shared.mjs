/** Phase 5.3A southern POI helpers. Does not rewrite the national index. */

import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { isNavReady } from "./gcis-score.mjs";

export const SOUTH_PILOT_REGIONS = Object.freeze([
  "雲林縣",
  "嘉義市",
  "嘉義縣",
  "臺南市",
  "高雄市",
  "屏東縣",
]);

export const SOUTH_PILOT_SET = new Set(SOUTH_PILOT_REGIONS);

export const DATA_VERSION = "south-pilot-20260913-batch10";

export const EXPECTED = {
  candidates: 226_721,
  located: 206_952,
  navReady: 179_717,
  unmatched: 19_769,
  review: 27_235,
};

export const TAIWAN_BOUNDS = {
  south: 21.7,
  north: 26.4,
  west: 118.1,
  east: 122.1,
};

const COUNTY_ALIASES = [
  [/台北市|臺北市/, "臺北市"],
  [/新北市/, "新北市"],
  [/桃園市|桃園縣/, "桃園市"],
  [/台中市|臺中市/, "臺中市"],
  [/台南市|臺南市/, "臺南市"],
  [/高雄市/, "高雄市"],
  [/基隆市/, "基隆市"],
  [/新竹市/, "新竹市"],
  [/新竹縣/, "新竹縣"],
  [/苗栗/, "苗栗縣"],
  [/彰化/, "彰化縣"],
  [/南投/, "南投縣"],
  [/雲林/, "雲林縣"],
  [/嘉義市/, "嘉義市"],
  [/嘉義縣/, "嘉義縣"],
  [/屏東/, "屏東縣"],
  [/宜蘭/, "宜蘭縣"],
  [/花蓮/, "花蓮縣"],
  [/台東|臺東/, "臺東縣"],
  [/澎湖/, "澎湖縣"],
  [/金門/, "金門縣"],
  [/連江|馬祖/, "連江縣"],
];

/** Generous declared-county envelopes. Adjacent south counties overlap; that is not a conflict. */
const COUNTY_BOXES = {
  雲林縣: { south: 23.45, north: 23.92, west: 120.02, east: 120.82 },
  嘉義市: { south: 23.43, north: 23.54, west: 120.39, east: 120.51 },
  嘉義縣: { south: 23.12, north: 23.66, west: 120.08, east: 120.88 },
  臺南市: { south: 22.80, north: 23.46, west: 119.92, east: 120.72 },
  高雄市: { south: 22.28, north: 23.32, west: 120.10, east: 121.05 },
  屏東縣: { south: 21.70, north: 22.95, west: 120.28, east: 120.98 },
};

const LIFE = new Set([
  "bank",
  "atm",
  "post-office",
  "police",
  "fire-station",
  "government",
  "public-facility",
  "life",
]);

const VAGUE_NAME = /^(診所|商店|公司|行號|企業社|商行|行|行號公司)$/;

export function normalizeCounty(value) {
  const text = String(value || "")
    .replaceAll("台", "臺")
    .replace(/\s+/g, "")
    .trim();
  if (SOUTH_PILOT_SET.has(text)) return text;
  for (const [pattern, name] of COUNTY_ALIASES) {
    if (pattern.test(text)) return name;
  }
  return text || null;
}

export function countyFromText(value) {
  return normalizeCounty(value);
}

export function countyFromLngLat(lat, lng) {
  for (const [name, box] of Object.entries(COUNTY_BOXES)) {
    if (lat >= box.south && lat <= box.north && lng >= box.west && lng <= box.east) {
      return name;
    }
  }
  return null;
}

export function isClearlyOutsideCounty(county, lat, lng) {
  const box = COUNTY_BOXES[county];
  if (!box || !Number.isFinite(lat) || !Number.isFinite(lng)) return false;
  return lat < box.south || lat > box.north || lng < box.west || lng > box.east;
}

export function isInTaiwan(lat, lng) {
  return (
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= TAIWAN_BOUNDS.south &&
    lat <= TAIWAN_BOUNDS.north &&
    lng >= TAIWAN_BOUNDS.west &&
    lng <= TAIWAN_BOUNDS.east
  );
}

export function normalizeName(value) {
  return String(value || "")
    .toLowerCase()
    .replaceAll("臺", "台")
    .replace(/[（）()]/g, "")
    .replace(/[\s\-_.＋+]/g, "");
}

export function normalizeAddress(value) {
  return String(value || "")
    .replaceAll("台", "臺")
    .replace(/[０-９]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0xfee0))
    .replace(/\s+/g, "")
    .trim();
}

export function mainLayerFromTags(category, subcategory) {
  const keys = [subcategory, category]
    .map((value) => String(value || "").toLowerCase().replaceAll("_", "-"))
    .filter(Boolean);
  const food = new Set([
    "restaurant",
    "cafe",
    "breakfast",
    "fast-food",
    "drink",
    "convenience",
    "supermarket",
    "food-shop",
    "bakery",
    "bar",
    "ice-cream",
    "tea",
    "food",
  ]);
  const clothing = new Set([
    "clothing",
    "clothes",
    "shoes",
    "sportswear",
    "accessories",
    "jewelry",
    "bag",
    "boutique",
    "mall",
    "department_store",
    "department-store",
  ]);
  const housing = new Set([
    "hotel",
    "hostel",
    "homestay",
    "furniture",
    "home",
    "houseware",
    "building-materials",
    "hardware",
    "doityourself",
    "interior",
    "housing",
  ]);
  const transport = new Set([
    "parking",
    "fuel",
    "charging",
    "railway",
    "mrt",
    "bus",
    "car-rental",
    "auto-repair",
    "station",
    "car",
    "transport",
  ]);
  const education = new Set([
    "school",
    "tutoring",
    "library",
    "museum",
    "education",
    "college",
    "kindergarten",
    "bookstore",
    "books",
  ]);
  const leisure = new Set([
    "attraction",
    "park",
    "cinema",
    "entertainment",
    "sports",
    "landmark",
    "karaoke",
    "nightclub",
    "leisure",
  ]);
  const medical = new Set([
    "hospital",
    "clinic",
    "pharmacy",
    "dentist",
    "doctors",
    "medical",
  ]);
  for (const key of keys) {
    if (food.has(key)) return "food";
    if (clothing.has(key)) return "clothing";
    if (housing.has(key)) return "housing";
    if (transport.has(key)) return "transport";
    if (education.has(key)) return "education";
    if (medical.has(key)) return "medical";
    if (LIFE.has(key)) return "life";
    if (leisure.has(key)) return "leisure";
  }
  return "life";
}

export function isVagueName(name) {
  return VAGUE_NAME.test(String(name || "").replace(/\s+/g, ""));
}

export function isCountyOnlyAddress(address, county) {
  const compact = normalizeAddress(address);
  if (!compact || !county) return false;
  return compact === county || compact === `${county}`;
}

export function parseJsonArrayBuffer(buf) {
  const rows = [];
  let depth = 0;
  let start = -1;
  let inString = false;
  let escape = false;
  for (let index = 0; index < buf.length; index += 1) {
    const code = buf[index];
    if (inString) {
      if (escape) escape = false;
      else if (code === 0x5c) escape = true;
      else if (code === 0x22) inString = false;
      continue;
    }
    if (code === 0x22) {
      inString = true;
      continue;
    }
    if (code === 0x7b) {
      if (depth === 0) start = index;
      depth += 1;
    } else if (code === 0x7d) {
      depth -= 1;
      if (depth === 0 && start >= 0) {
        rows.push(JSON.parse(buf.subarray(start, index + 1).toString("utf8")));
        start = -1;
      }
    }
  }
  return rows;
}

export function loadPoiRows(filePath) {
  if (!existsSync(filePath)) return [];
  const raw = readFileSync(filePath);
  const buf = filePath.endsWith(".gz") ? gunzipSync(raw) : raw;
  return parseJsonArrayBuffer(buf);
}

export function sha256File(filePath) {
  if (!existsSync(filePath)) return null;
  return createHash("sha256").update(readFileSync(filePath)).digest("hex");
}

export class SouthPoiSourceError extends Error {
  constructor(code, details) {
    super(code);
    this.name = "SouthPoiSourceError";
    this.code = code;
    this.details = details;
  }
}

export function classifyRow(row) {
  const lat = Number(row.latitude);
  const lng = Number(row.longitude);
  const address = normalizeAddress(row.address);
  const name = String(row.name || "").trim();
  const source = String(row.source || "gov");
  const sourceId = String(row.sourceId || row.source_id || row.id || "");
  const declared =
    countyFromText(row.county) ||
    countyFromText(row.city) ||
    countyFromText(address);
  const county = SOUTH_PILOT_SET.has(declared)
    ? declared
    : countyFromText(address) && SOUTH_PILOT_SET.has(countyFromText(address))
      ? countyFromText(address)
      : declared;
  const layer = mainLayerFromTags(row.mainCategory || row.main_category, row.category);
  const quality = row.matchQuality || row.match_quality || null;
  const score =
    typeof row.navEligibilityScore === "number"
      ? row.navEligibilityScore
      : typeof row.nav_eligibility_score === "number"
        ? row.nav_eligibility_score
        : 0;
  const reasons = [];
  if (!name) reasons.push("missing_name");
  if (!sourceId) reasons.push("missing_source_id");
  if (!isInTaiwan(lat, lng)) reasons.push("coords_out_of_taiwan");
  if (!SOUTH_PILOT_SET.has(county)) reasons.push("outside_south_pilot");
  if (SOUTH_PILOT_SET.has(county) && isInTaiwan(lat, lng) && isClearlyOutsideCounty(county, lat, lng)) {
    reasons.push("county_geom_conflict");
  }
  if (isVagueName(name)) reasons.push("vague_name");
  if (isCountyOnlyAddress(address, county)) reasons.push("county_only_address");
  if (layer === "life" && !LIFE.has(String(row.category || "").toLowerCase())) {
    reasons.push("uncategorized_life");
  }

  const located = isInTaiwan(lat, lng) && SOUTH_PILOT_SET.has(county);
  const gcisNavReady = located && row.isActive !== false && isNavReady(quality || "E", score);
  const navReady =
    gcisNavReady &&
    !reasons.includes("county_geom_conflict") &&
    !reasons.includes("vague_name") &&
    !reasons.includes("county_only_address");

  let publishStatus = "disabled";
  if (!located || reasons.includes("outside_south_pilot") || reasons.includes("coords_out_of_taiwan")) {
    publishStatus = "reject";
  } else if (navReady && !reasons.includes("uncategorized_life")) {
    publishStatus = "published";
  } else {
    publishStatus = "review";
  }

  return {
    id: String(row.id || `${source}:${sourceId}`),
    source,
    sourceId,
    name,
    nameNormalized: normalizeName(name),
    aliases: Array.isArray(row.aliases) ? row.aliases : [],
    brand: row.brand ?? null,
    branchName: row.branchName ?? row.branch_name ?? null,
    originalCategory: String(row.category || row.subcategory || "other"),
    category: layer,
    subcategory: String(row.subcategory || row.category || ""),
    address,
    addressNormalized: normalizeAddress(address),
    county,
    district: row.district ?? null,
    latitude: lat,
    longitude: lng,
    phone: row.phone ?? null,
    openingHours: row.hours ?? row.openingHours ?? row.opening_hours ?? null,
    qualityGrade: quality,
    navScore: score,
    located,
    gcisNavReady,
    navReady,
    isActive: row.isActive !== false,
    publishStatus,
    dataVersion: DATA_VERSION,
    sourceUpdatedAt: row.sourceUpdatedAt ?? row.source_updated_at ?? row.updatedAt ?? null,
    lastSeenAt: row.lastSeenAt ?? row.last_seen_at ?? null,
    reasons,
    license: row.license ?? "OGDL-Taiwan-1.0",
  };
}

export function toSupabasePoiRow(row, now = new Date().toISOString()) {
  const lat = Number(row.latitude);
  const lng = Number(row.longitude);
  const payload = {
    id: row.id,
    name: row.name,
    name_normalized: row.nameNormalized,
    aliases: Array.isArray(row.aliases) ? row.aliases : [],
    category: row.originalCategory || row.subcategory || row.category || "other",
    main_category: row.category,
    subcategory: row.subcategory || null,
    brand: row.brand,
    branch_name: row.branchName,
    address: row.address || "",
    address_normalized: row.addressNormalized || "",
    city: row.county,
    county: row.county,
    district: row.district,
    latitude: lat,
    longitude: lng,
    source: row.source,
    source_id: row.sourceId,
    updated_at: now,
    license: row.license || "OGDL-Taiwan-1.0",
    confidence: Math.min(1, Math.max(0, Number(row.navScore || 0) / 100)),
    is_active: row.isActive !== false,
    phone: row.phone ?? null,
    opening_hours: row.openingHours ?? null,
    quality_grade: row.qualityGrade ?? null,
    nav_score: Number.isFinite(Number(row.navScore)) ? Number(row.navScore) : 0,
    nav_ready: Boolean(row.navReady),
    publish_status: row.publishStatus,
    data_version: row.dataVersion || DATA_VERSION,
    source_updated_at: row.sourceUpdatedAt || now,
    last_seen_at: now,
  };
  if (Number.isFinite(lat) && Number.isFinite(lng)) {
    payload.geom = `SRID=4326;POINT(${lng} ${lat})`;
  }
  return payload;
}

export function collectSouthPoiRows(rawRows, counties, { publishedOnly = false } = {}) {
  const wanted = new Set(counties);
  const seen = new Set();
  const collected = [];
  for (const raw of rawRows) {
    const classified = classifyRow(raw);
    if (!wanted.has(classified.county) || !SOUTH_PILOT_SET.has(classified.county)) continue;
    if (!classified.located) continue;
    if (publishedOnly && classified.publishStatus !== "published") continue;
    const key = `${classified.source}:${classified.sourceId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    collected.push(classified);
  }
  const rank = (row) => {
    const countyRank = counties.indexOf(row.county);
    const publishedRank = row.publishStatus === "published" ? 0 : 1;
    return countyRank * 10 + publishedRank;
  };
  collected.sort((a, b) => rank(a) - rank(b) || a.id.localeCompare(b.id));
  return collected;
}

export function resolveSouthPoiIndex(expectedSha = null) {
  const candidates = [
    process.env.NAVPILOT_POI_INDEX,
    "/tmp/phase53a-src/taiwan-poi-index.json.gz",
    "src/data/taiwan-poi-index.json.gz",
  ].filter(Boolean);
  const existing = candidates.filter((path) => existsSync(path));
  if (expectedSha) {
    const inspected = existing.map((path) => ({ path, sha256: sha256File(path) }));
    const matched = inspected.find((candidate) => candidate.sha256 === expectedSha);
    if (matched) return { ...matched, matched: true };
    throw new SouthPoiSourceError(existing.length ? "source_sha_mismatch" : "missing_source_index", {
      expectedSha,
      candidates: inspected,
    });
  }
  if (!existing.length) return { path: null, sha256: null, matched: false };
  const path = existing[0];
  return { path, sha256: sha256File(path), matched: expectedSha ? false : null };
}

export function parseCountyList(value) {
  if (!value || !String(value).trim()) {
    return { selected: [...SOUTH_PILOT_REGIONS], unknown: [], raw: [...SOUTH_PILOT_REGIONS] };
  }
  const counties = String(value)
    .split(/[,，\s]+/)
    .map((item) => normalizeCounty(item))
    .filter(Boolean);
  const unknown = counties.filter((county) => !SOUTH_PILOT_SET.has(county));
  const selected = SOUTH_PILOT_REGIONS.filter((county) => counties.includes(county));
  return { selected, unknown, raw: counties };
}
