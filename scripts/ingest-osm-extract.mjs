#!/usr/bin/env node
/**
 * Structured Taiwan POI ingest from a legal OSM extract (BBBike / Geofabrik).
 * Photon is not used as the primary source.
 */
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { basename } from "node:path";
import { gzipSync } from "node:zlib";

const USER_AGENT = "NavPilot/0.1 (https://github.com/jin358-cmd/nav-map)";
const CACHE_DIR = "/tmp/osm-taiwan";
const PBF_URL = process.env.OSM_PBF_URL ?? "https://data.bbbike.org/osm/pbf/region/asia/taiwan.osm.pbf";
const PBF_PATH = process.env.OSM_PBF_PATH ?? `${CACHE_DIR}/taiwan.osm.pbf`;
const FILTERED_PBF = `${CACHE_DIR}/taiwan-pois.osm.pbf`;
const GEOJSONL = `${CACHE_DIR}/taiwan-pois.geojsonl`;
const OUT = "src/data/taiwan-poi-index.json";
const REJECTS = "docs/poi-import-rejects.json";
const REPORT = "docs/poi-ingest-report.json";
const MANIFEST = "src/data/poi-ingest-manifest.json";
const CHECKPOINT = "src/data/poi-ingest-checkpoint.json";
const ACCEPTED_CACHE = `${CACHE_DIR}/accepted-rows.json`;

const COUNTIES = [
  "臺北市",
  "新北市",
  "桃園市",
  "臺中市",
  "臺南市",
  "高雄市",
  "基隆市",
  "新竹市",
  "新竹縣",
  "苗栗縣",
  "彰化縣",
  "南投縣",
  "雲林縣",
  "嘉義市",
  "嘉義縣",
  "屏東縣",
  "宜蘭縣",
  "花蓮縣",
  "臺東縣",
  "澎湖縣",
  "金門縣",
  "連江縣",
];

const COUNTY_BOXES = [
  { name: "連江縣", south: 25.93, north: 26.39, west: 119.9, east: 120.52 },
  { name: "金門縣", south: 24.37, north: 24.54, west: 118.2, east: 118.52 },
  { name: "澎湖縣", south: 23.18, north: 23.8, west: 119.3, east: 119.75 },
  { name: "基隆市", south: 25.1, north: 25.2, west: 121.68, east: 121.8 },
  { name: "新竹市", south: 24.76, north: 24.86, west: 120.9, east: 121.04 },
  { name: "嘉義市", south: 23.45, north: 23.52, west: 120.42, east: 120.49 },
  { name: "臺北市", south: 24.96, north: 25.21, west: 121.45, east: 121.67 },
  { name: "宜蘭縣", south: 24.33, north: 24.88, west: 121.32, east: 121.98 },
  { name: "桃園市", south: 24.82, north: 25.13, west: 120.98, east: 121.48 },
  { name: "新竹縣", south: 24.42, north: 24.9, west: 120.88, east: 121.36 },
  { name: "苗栗縣", south: 24.3, north: 24.75, west: 120.62, east: 121.26 },
  { name: "臺中市", south: 24.0, north: 24.45, west: 120.45, east: 121.45 },
  { name: "彰化縣", south: 23.82, north: 24.2, west: 120.22, east: 120.68 },
  { name: "南投縣", south: 23.43, north: 24.15, west: 120.68, east: 121.3 },
  { name: "雲林縣", south: 23.5, north: 23.86, west: 120.15, east: 120.72 },
  { name: "嘉義縣", south: 23.2, north: 23.62, west: 120.18, east: 120.8 },
  { name: "臺南市", south: 22.87, north: 23.42, west: 120.02, east: 120.66 },
  { name: "高雄市", south: 22.48, north: 23.28, west: 120.17, east: 120.97 },
  { name: "屏東縣", south: 21.9, north: 22.88, west: 120.36, east: 120.9 },
  { name: "花蓮縣", south: 23.1, north: 24.4, west: 121.15, east: 121.78 },
  { name: "臺東縣", south: 22.2, north: 23.45, west: 120.8, east: 121.62 },
  { name: "新北市", south: 24.85, north: 25.3, west: 121.28, east: 122.01 },
];

const BRANDS = [
  { brand: "7-Eleven", category: "convenience", keys: ["7-eleven", "7eleven", "7-11", "711", "統一超商", "小七"], label: "7-ELEVEN" },
  { brand: "FamilyMart", category: "convenience", keys: ["familymart", "family mart", "全家"], label: "全家便利商店" },
  { brand: "Hi-Life", category: "convenience", keys: ["hi-life", "hilife", "萊爾富"], label: "萊爾富" },
  { brand: "OK Mart", category: "convenience", keys: ["ok mart", "okmart", "ok超商"], label: "OK超商" },
  { brand: "PX Mart", category: "supermarket", keys: ["px mart", "pxmart", "全聯"], label: "全聯福利中心" },
  { brand: "Carrefour", category: "supermarket", keys: ["carrefour", "家樂福"], label: "家樂福" },
  { brand: "Costco", category: "supermarket", keys: ["costco", "好市多"], label: "好市多" },
  { brand: "Simple Mart", category: "supermarket", keys: ["simple mart", "simplemart", "美廉社"], label: "美廉社" },
  { brand: "Starbucks", category: "cafe", keys: ["starbucks", "星巴克"], label: "星巴克" },
  { brand: "Louisa", category: "cafe", keys: ["louisa", "路易莎"], label: "路易莎咖啡" },
  { brand: "85C", category: "cafe", keys: ["85c", "85度c", "85度"], label: "85度C" },
  { brand: "McDonald's", category: "restaurant", keys: ["mcdonald", "麥當勞"], label: "麥當勞" },
  { brand: "KFC", category: "restaurant", keys: ["kfc", "肯德基"], label: "肯德基" },
  { brand: "MOS Burger", category: "restaurant", keys: ["mos burger", "mos", "摩斯"], label: "摩斯漢堡" },
  { brand: "CPC", category: "fuel", keys: ["cpc", "中油", "台灣中油"], label: "台灣中油" },
  { brand: "Formosa", category: "fuel", keys: ["formosa", "台塑"], label: "台塑石化" },
];

const DEFAULT_NAME = {
  parking: "停車場",
  fuel: "加油站",
  hospital: "醫院",
  clinic: "診所",
  pharmacy: "藥局",
  school: "學校",
  government: "政府機關",
  station: "車站",
  park: "公園",
};

function compact(value) {
  return String(value ?? "")
    .toLowerCase()
    .replaceAll("臺", "台")
    .replace(/[（）()]/g, "")
    .replace(/[\s\-_.＋+]/g, "");
}

function inTaiwan(lat, lng) {
  return lng >= 118 && lng <= 122.2 && lat >= 21.7 && lat <= 26.4;
}

function countyFromText(text) {
  const value = String(text ?? "");
  const match = value.match(
    /(臺北市|台北市|新北市|桃園市|臺中市|台中市|臺南市|台南市|高雄市|基隆市|新竹市|新竹縣|苗栗縣|彰化縣|南投縣|雲林縣|嘉義市|嘉義縣|屏東縣|宜蘭縣|花蓮縣|臺東縣|台東縣|澎湖縣|金門縣|連江縣)/,
  );
  return match?.[1]?.replaceAll("台", "臺") ?? null;
}

function countyFromLngLat(lat, lng) {
  for (const box of COUNTY_BOXES) {
    if (lat >= box.south && lat <= box.north && lng >= box.west && lng <= box.east) return box.name;
  }
  return null;
}

function run(cmd, args) {
  const result = spawnSync(cmd, args, { stdio: "inherit" });
  if (result.status !== 0) throw new Error(`${cmd} ${args.join(" ")} failed`);
}

function downloadPbf() {
  if (existsSync(PBF_PATH) && statSync(PBF_PATH).size > 50_000_000) {
    console.log(`reuse ${PBF_PATH}`);
    return;
  }
  mkdirSync(CACHE_DIR, { recursive: true });
  console.log(`download ${PBF_URL}`);
  run("curl", ["-L", "--fail", "--retry", "4", "--retry-delay", "8", "-A", USER_AGENT, "-o", PBF_PATH, PBF_URL]);
}

function filterExtract() {
  if (existsSync(GEOJSONL) && statSync(GEOJSONL).size > 1_000_000) {
    console.log(`reuse ${GEOJSONL}`);
    return;
  }
  console.log("osmium tags-filter");
  run("osmium", [
    "tags-filter",
    "-R",
    PBF_PATH,
    "nwr/amenity",
    "nwr/shop",
    "nwr/tourism",
    "nwr/leisure=park",
    "nwr/leisure=playground",
    "nwr/office=government",
    "nwr/office=administrative",
    "nwr/railway=station",
    "nwr/public_transport=station",
    "nwr/aeroway=terminal",
    "-o",
    FILTERED_PBF,
    "--overwrite",
  ]);
  console.log("osmium export geojsonseq");
  run("osmium", ["export", FILTERED_PBF, "-f", "geojsonseq", "-o", GEOJSONL, "--overwrite"]);
}

function centroid(geometry) {
  if (!geometry) return null;
  if (geometry.type === "Point" && Array.isArray(geometry.coordinates)) {
    return { lng: Number(geometry.coordinates[0]), lat: Number(geometry.coordinates[1]) };
  }
  const ring = [];
  const walk = (value) => {
    if (!Array.isArray(value)) return;
    if (typeof value[0] === "number" && typeof value[1] === "number") {
      ring.push([Number(value[0]), Number(value[1])]);
      return;
    }
    for (const item of value) walk(item);
  };
  walk(geometry.coordinates);
  if (!ring.length) return null;
  const sum = ring.reduce((acc, pair) => [acc[0] + pair[0], acc[1] + pair[1]], [0, 0]);
  return { lng: sum[0] / ring.length, lat: sum[1] / ring.length };
}

function classifyTags(tags) {
  const amenity = tags.amenity;
  const shop = tags.shop;
  const tourism = tags.tourism;
  const leisure = tags.leisure;
  const office = tags.office;
  const railway = tags.railway;
  const publicTransport = tags.public_transport;
  if (shop === "convenience") return "convenience";
  if (shop === "supermarket" || shop === "wholesale" || shop === "chemist") return "supermarket";
  if (shop === "mall" || shop === "department_store") return "mall";
  if (amenity === "fuel" || amenity === "charging_station") return "fuel";
  if (amenity === "parking" || amenity === "parking_entrance") return "parking";
  if (amenity === "hospital") return "hospital";
  if (amenity === "clinic" || amenity === "doctors" || amenity === "dentist") return "clinic";
  if (amenity === "pharmacy") return "pharmacy";
  if (amenity === "cafe") return "cafe";
  if (amenity === "restaurant" || amenity === "fast_food" || amenity === "food_court") return "restaurant";
  if (
    amenity === "school" ||
    amenity === "university" ||
    amenity === "college" ||
    amenity === "kindergarten"
  ) {
    return "school";
  }
  if (amenity === "police" || amenity === "fire_station" || amenity === "townhall" || amenity === "post_office") {
    return "government";
  }
  if (office === "government" || office === "administrative") return "government";
  if (tourism === "hotel" || tourism === "guest_house" || tourism === "hostel" || tourism === "motel") return "hotel";
  if (tourism === "attraction" || tourism === "museum" || tourism === "viewpoint" || tourism === "zoo") {
    return "landmark";
  }
  if (leisure === "park" || leisure === "playground" || leisure === "garden") return "park";
  if (railway === "station" || publicTransport === "station" || amenity === "bus_station") return "station";
  if (shop === "bakery" || shop === "coffee") return "cafe";
  if (shop === "clothes" || shop === "fashion_accessories" || shop === "boutique") return "other";
  if (shop === "shoes") return "other";
  if (shop === "furniture" || shop === "doityourself" || shop === "hardware") return "other";
  if (shop) return "other";
  if (amenity || tourism) return "other";
  return null;
}

function matchBrand(name, brandTag, operator) {
  const hay = compact(`${name} ${brandTag} ${operator}`);
  return BRANDS.find((item) => item.keys.some((key) => hay.includes(compact(key)))) ?? null;
}

function splitBranch(name, brand) {
  if (!brand) return { name, branchName: null };
  const label = brand.label;
  const compactName = name.replace(/\s+/g, "");
  const compactLabel = label.replace(/\s+/g, "");
  let rest = compactName;
  if (compactName.startsWith(compactLabel)) rest = compactName.slice(compactLabel.length);
  else if (compactName.startsWith(brand.brand.replace(/\s+/g, ""))) {
    rest = compactName.slice(brand.brand.replace(/\s+/g, "").length);
  }
  rest = rest.replace(/^的/, "").trim();
  if (rest && (rest.endsWith("店") || rest.endsWith("門市") || rest.length >= 2) && rest !== compactName) {
    return { name: compactName.includes(compactLabel) ? name : `${label}${rest}`, branchName: rest };
  }
  return { name, branchName: null };
}

function buildAddress(tags, city, district) {
  const parts = [
    tags["addr:full"],
    tags["addr:city"] || city,
    tags["addr:district"] || district,
    tags["addr:place"],
    tags["addr:street"],
    tags["addr:housenumber"],
  ].filter(Boolean);
  return [...new Set(parts)].join("");
}

function confidenceFor(row) {
  if (row.address && row.city && row.brand) return 0.92;
  if (row.address && row.city) return 0.88;
  if (row.city && row.brand) return 0.84;
  if (row.city) return 0.8;
  return 0.74;
}

function reject(rejects, raw, reason) {
  rejects.push({
    source: "osm",
    source_id: String(raw.id ?? ""),
    reason,
    raw_data: {
      name: raw.name,
      category: raw.category,
      lat: raw.latitude,
      lng: raw.longitude,
    },
    created_at: new Date().toISOString(),
  });
}

function gridKey(lat, lng) {
  return `${Math.round(lat * 3700)}:${Math.round(lng * 3700)}`;
}

function readGeojsonl() {
  const raw = readFileSync(GEOJSONL, "utf8");
  const rows = [];
  for (const chunk of raw.split(/\u001e/)) {
    const text = chunk.trim();
    if (!text) continue;
    try {
      rows.push(JSON.parse(text));
    } catch {
      /* skip broken record */
    }
  }
  return rows;
}

function featureToPoi(feature, now) {
  const tags = feature.properties ?? {};
  const loc = centroid(feature.geometry);
  if (!loc || !inTaiwan(loc.lat, loc.lng)) return { reject: "out_of_taiwan_or_no_geom" };
  const category = classifyTags(tags);
  if (!category) return { reject: "category_unmapped" };
  const name =
    String(tags.name || tags["name:zh"] || tags["name:zh-Hant"] || tags["name:en"] || "").trim() ||
    DEFAULT_NAME[category] ||
    "";
  if (!name) return { reject: "missing_name" };
  if (/^(yes|no|\d+)$/i.test(name)) return { reject: "placeholder_name" };
  const brandHit = matchBrand(name, tags.brand, tags.operator);
  const split = splitBranch(name, brandHit);
  const city =
    countyFromText(tags["addr:city"] || tags["addr:province"] || tags["addr:state"]) ||
    countyFromLngLat(loc.lat, loc.lng);
  const district = tags["addr:district"] || tags["addr:suburb"] || tags["addr:town"] || null;
  const address = buildAddress(tags, city, district);
  const aliases = [];
  if (brandHit) aliases.push(...brandHit.keys);
  if (split.branchName) aliases.push(split.branchName);
  const osmId = String(tags["@id"] || tags.id || tags.osm_id || feature.id || `${loc.lng},${latSafe(loc)}`);
  const sourceId = osmId.replace(/^.*\//, "");
  const row = {
    id: `osm-${sourceId}`,
    name: split.name,
    nameNormalized: compact(split.name),
    aliases: [...new Set(aliases.map(compact).filter(Boolean))],
    category: brandHit?.category || category,
    subcategory: subcategoryFromTags(tags, brandHit?.category || category),
    mainCategory: null,
    brand: brandHit?.brand ?? (tags.brand ? String(tags.brand) : null),
    branchName: split.branchName,
    address,
    addressNormalized: compact(address),
    city,
    county: city,
    district,
    latitude: loc.lat,
    longitude: loc.lng,
    source: "osm",
    sourceId,
    updatedAt: now,
    lastSeenAt: now,
    sourceUpdatedAt: tags["@timestamp"] || now,
    license: "ODbL",
    confidence: 0,
    isActive: true,
  };
  row.confidence = confidenceFor(row);
  row.mainCategory = mainLayerFrom(row.category, row.subcategory);
  return { row };
}

function subcategoryFromTags(tags, category) {
  const shop = String(tags.shop ?? "");
  const amenity = String(tags.amenity ?? "");
  const tourism = String(tags.tourism ?? "");
  if (amenity === "fast_food") return "fast-food";
  if (amenity === "cafe" || shop === "coffee") return "cafe";
  if (amenity === "charging_station") return "charging";
  if (amenity === "fuel") return "fuel";
  if (shop === "clothes" || shop === "boutique") return "clothing";
  if (shop === "shoes") return "shoes";
  if (shop === "sports") return "sportswear";
  if (shop === "furniture") return "furniture";
  if (shop === "doityourself" || shop === "hardware") return "building-materials";
  if (tourism === "hostel") return "hostel";
  if (tourism === "guest_house") return "homestay";
  if (amenity === "library") return "library";
  if (tourism === "museum") return "museum";
  if (amenity === "cinema") return "cinema";
  if (amenity === "bank") return "bank";
  if (amenity === "atm") return "atm";
  if (amenity === "post_office") return "post-office";
  if (amenity === "police") return "police";
  if (amenity === "fire_station") return "fire-station";
  return category;
}

function mainLayerFrom(category, subcategory) {
  const key = String(subcategory || category || "");
  const food = new Set(["restaurant", "cafe", "breakfast", "fast-food", "drink", "convenience", "supermarket", "food-shop"]);
  const clothing = new Set(["clothing", "shoes", "sportswear", "accessories"]);
  const housing = new Set(["hotel", "hostel", "homestay", "furniture", "home", "building-materials"]);
  const transport = new Set(["parking", "fuel", "charging", "railway", "mrt", "bus", "car-rental", "auto-repair", "station"]);
  const education = new Set(["school", "tutoring", "library", "museum", "education"]);
  const leisure = new Set(["attraction", "park", "cinema", "mall", "entertainment", "sports", "landmark"]);
  const medical = new Set(["hospital", "clinic", "pharmacy", "bank", "atm", "post-office", "police", "fire-station", "government", "public-facility"]);
  if (food.has(key) || food.has(category)) return "food";
  if (clothing.has(key)) return "clothing";
  if (housing.has(key) || housing.has(category)) return "housing";
  if (transport.has(key) || transport.has(category)) return "transport";
  if (education.has(key) || education.has(category)) return "education";
  if (medical.has(key) || medical.has(category)) return "medical";
  if (leisure.has(key) || leisure.has(category)) return "leisure";
  return "leisure";
}

function keepNavigable(row) {
  if (!row?.name || compact(row.name).length < 2) return false;
  return true;
}

function slimRow(row) {
  const subcategory = row.subcategory || row.category;
  return {
    ...row,
    subcategory,
    mainCategory: row.mainCategory || mainLayerFrom(row.category, subcategory),
  };
}

function loadCheckpoint() {
  if (process.env.POI_INGEST_RESET === "1") return null;
  if (!existsSync(CHECKPOINT)) return null;
  try {
    return JSON.parse(readFileSync(CHECKPOINT, "utf8"));
  } catch {
    return null;
  }
}

function latSafe(loc) {
  return `${loc.lat.toFixed(5)}`;
}

function dedupRows(rows) {
  const bySource = new Map();
  let sourceDup = 0;
  for (const row of rows) {
    const key = `${row.source}:${row.sourceId}`;
    if (bySource.has(key)) {
      sourceDup += 1;
      continue;
    }
    bySource.set(key, row);
  }
  const spatial = new Map();
  let spatialDup = 0;
  const kept = [];
  for (const row of bySource.values()) {
    const key = `${row.category}|${row.brand || ""}|${gridKey(row.latitude, row.longitude)}`;
    const prev = spatial.get(key);
    if (prev) {
      const sameName = prev.nameNormalized === row.nameNormalized;
      const sameBrand = Boolean(row.brand && prev.brand === row.brand);
      const sameAddr = row.addressNormalized && row.addressNormalized === prev.addressNormalized;
      if (sameName || sameBrand || sameAddr) {
        spatialDup += 1;
        if (row.confidence > prev.confidence) {
          spatial.set(key, row);
          kept[kept.indexOf(prev)] = row;
        }
        continue;
      }
    }
    spatial.set(key, row);
    kept.push(row);
  }
  return { rows: kept, sourceDup, spatialDup };
}

function loadExisting() {
  if (!existsSync(OUT)) return [];
  try {
    return JSON.parse(readFileSync(OUT, "utf8"));
  } catch {
    return [];
  }
}

async function main() {
  const started = Date.now();
  mkdirSync(CACHE_DIR, { recursive: true });
  mkdirSync("docs", { recursive: true });
  downloadPbf();
  filterExtract();
  const features = readGeojsonl();
  console.log(`features ${features.length}`);
  const now = new Date().toISOString();
  const jobId = process.env.POI_INGEST_JOB || `poi-${now.slice(0, 10)}`;
  const checkpoint = loadCheckpoint();
  const resume =
    checkpoint &&
    checkpoint.status === "in_progress" &&
    checkpoint.jobId === jobId
      ? checkpoint
      : null;
  let startOffset = resume?.resumeOffset ?? 0;
  if (startOffset > features.length) startOffset = 0;
  const countyStats = Object.fromEntries(
    COUNTIES.map((name) => [name, { fetched: 0, imported: 0, rejected: 0, dedup: 0 }]),
  );
  countyStats["未知"] = { fetched: 0, imported: 0, rejected: 0, dedup: 0 };
  const rejects = [];
  let accepted = [];
  if (resume && existsSync(ACCEPTED_CACHE)) {
    try {
      accepted = JSON.parse(readFileSync(ACCEPTED_CACHE, "utf8"));
      console.log(`resume job ${jobId} from offset ${startOffset}, kept ${accepted.length}`);
    } catch {
      accepted = [];
      startOffset = 0;
    }
  }
  let fetched = resume?.fetched ?? 0;
  let rejected = resume?.rejected ?? 0;
  const batches = [];
  for (let i = startOffset; i < features.length; i += BATCH_SIZE) {
    const batchId = Math.floor(i / BATCH_SIZE) + 1;
    const batchStarted = Date.now();
    const batch = features.slice(i, i + BATCH_SIZE);
    let batchFetched = 0;
    let batchInserted = 0;
    let batchRejected = 0;
    try {
      for (const feature of batch) {
        fetched += 1;
        batchFetched += 1;
        const result = featureToPoi(feature, now);
        const city = result.row?.city || "未知";
        if (countyStats[city]) countyStats[city].fetched += 1;
        if (result.reject) {
          rejected += 1;
          batchRejected += 1;
          if (countyStats[city]) countyStats[city].rejected += 1;
          if (rejects.length < 800) reject(rejects, result.row ?? {}, result.reject);
          continue;
        }
        if (!keepNavigable(result.row)) {
          rejected += 1;
          batchRejected += 1;
          if (rejects.length < 800) reject(rejects, result.row, "low_value_other");
          continue;
        }
        accepted.push(slimRow(result.row));
        batchInserted += 1;
      }
      writeFileSync(ACCEPTED_CACHE, JSON.stringify(accepted));
      const nextOffset = i + BATCH_SIZE;
      const record = {
        jobId,
        status: "in_progress",
        batchId,
        lastSuccessfulBatch: batchId,
        resumeOffset: nextOffset,
        fetched,
        rejected,
        accepted: accepted.length,
        batch: {
          id: String(batchId).padStart(3, "0"),
          start: i,
          end: Math.min(nextOffset, features.length),
          fetched: batchFetched,
          inserted: batchInserted,
          updated: 0,
          deduplicated: 0,
          rejected: batchRejected,
          failed: 0,
          durationMs: Date.now() - batchStarted,
        },
      };
      batches.push(record.batch);
      writeFileSync(CHECKPOINT, `${JSON.stringify(record, null, 2)}\n`);
    } catch (error) {
      writeFileSync(
        CHECKPOINT,
        `${JSON.stringify(
          {
            jobId,
            status: "failed",
            lastSuccessfulBatch: Math.max(0, batchId - 1),
            resumeOffset: i,
            fetched,
            rejected,
            failureReason: error instanceof Error ? error.message : String(error),
          },
          null,
          2,
        )}\n`,
      );
      throw error;
    }
  }

  const existing = loadExisting().filter((row) => row.source && row.source !== "osm");
  const mergedIncoming = [...accepted, ...existing];
  const deduped = dedupRows(mergedIncoming);
  const incomingIds = new Set(accepted.map((row) => `${row.source}:${row.sourceId}`));
  let inactive = 0;
  const previousOsm = loadExisting().filter((row) => row.source === "osm");
  for (const row of previousOsm) {
    const key = `${row.source}:${row.sourceId}`;
    if (!incomingIds.has(key)) {
      deduped.rows.push({ ...row, isActive: false, updatedAt: now });
      inactive += 1;
    }
  }

  for (const row of deduped.rows) {
    if (row.isActive === false) continue;
    const city = row.city || "未知";
    if (countyStats[city]) countyStats[city].imported += 1;
  }

  const active = deduped.rows.filter((row) => row.isActive !== false);
  active.sort((a, b) => String(a.name).localeCompare(String(b.name), "zh-Hant"));
  const all = [...active, ...deduped.rows.filter((row) => row.isActive === false)];
  writeFileSync(OUT, `${JSON.stringify(all)}\n`);
  writeFileSync(`${OUT}.gz`, gzipSync(JSON.stringify(all)));

  const bySource = {};
  const byCategory = {};
  const byCity = {};
  for (const row of active) {
    bySource[row.source] = (bySource[row.source] ?? 0) + 1;
    byCategory[row.category] = (byCategory[row.category] ?? 0) + 1;
    byCity[row.city ?? "未知"] = (byCity[row.city ?? "未知"] ?? 0) + 1;
  }
  const durationMs = Date.now() - started;
  const report = {
    dataset: "taiwan_poi_index",
    source: "OpenStreetMap extract via BBBike/Geofabrik (ODbL)",
    extract: basename(PBF_PATH),
    photon: "not-used-as-primary",
    companyRegistry: "not-imported",
    fetched,
    inserted: active.length,
    updated: 0,
    deduplicated: deduped.sourceDup + deduped.spatialDup,
    rejected,
    inactive,
    durationMs,
    errorCount: 0,
    batchSize: BATCH_SIZE,
    resume: Boolean(resume),
    lastSuccessfulBatch: batches.at(-1)?.id ?? null,
    batches,
    bySource,
    byCategory,
    byCity,
    counties: countyStats,
    written: OUT,
    packed: `${OUT}.gz`,
    rejects: REJECTS,
  };
  writeFileSync(REPORT, `${JSON.stringify(report, null, 2)}\n`);
  writeFileSync(
    REJECTS,
    `${JSON.stringify({ total: rejected, sampled: rejects.length, rows: rejects }, null, 2)}\n`,
  );
  writeFileSync(
    MANIFEST,
    `${JSON.stringify(
      {
        version: 3,
        extractUrl: PBF_URL,
        updatedAt: now,
        active: active.length,
        total: all.length,
        incremental: true,
        resume: true,
      },
      null,
      2,
    )}\n`,
  );
  writeFileSync(
    CHECKPOINT,
    `${JSON.stringify(
      {
        jobId,
        status: "complete",
        lastSuccessfulBatch: batches.at(-1)?.id ?? null,
        resumeOffset: features.length,
        fetched,
        rejected,
        accepted: active.length,
      },
      null,
      2,
    )}\n`,
  );
  if (existsSync(ACCEPTED_CACHE)) {
    try {
      writeFileSync(ACCEPTED_CACHE, "[]");
    } catch {
      /* ignore */
    }
  }
  console.log(JSON.stringify({ active: active.length, fetched, rejected, dedup: report.deduplicated, durationMs }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
