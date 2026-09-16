#!/usr/bin/env node
/**
 * Per-county doorplate importer. One county failure must not stop others.
 *
 * Official files: ADDRESS_DOORPLATES_DIR/{縣市}.csv|json|geojson
 * If missing: south counties can stage NLSC-derived addresses (not official files).
 * Never writes Supabase unless ADDRESS_INDEX_APPLY=1 and a confirmed NavPilot project.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync } from "node:fs";
import { basename, extname, join } from "node:path";
import { spawnSync } from "node:child_process";
import { gunzipSync } from "node:zlib";
import { COUNTIES } from "./gcis-address.mjs";
import {
  EXPECTED_NAVPILOT_REF,
  EXPECTED_NAVPILOT_URL,
  SOUTH_ADDRESS_COUNTIES,
  cloudWriteGate,
  dedupeAddressRows,
  toAddressIndexRow,
} from "./address-import-shared.mjs";
import { countTable, readSupabaseConfig, supabaseRest } from "./supabase-navpilot.mjs";

const SOUTH = ["雲林縣", "嘉義市", "嘉義縣", "臺南市", "高雄市", "屏東縣"];
const DIR = process.env.ADDRESS_DOORPLATES_DIR || "";

function officialName(value) {
  return String(value || "")
    .replaceAll("台北", "臺北")
    .replaceAll("台中", "臺中")
    .replaceAll("台南", "臺南")
    .replaceAll("台東", "臺東")
    .replace(/\s+/g, "");
}

function countyFromFilename(name) {
  const stem = officialName(basename(name, extname(name)));
  return COUNTIES.find((county) => county === stem || county.replaceAll("臺", "台") === stem) || null;
}

function twd97ToWgs84(easting, northing) {
  const a = 6378137.0;
  const b = 6356752.314245;
  const lng0 = (121 * Math.PI) / 180;
  const k0 = 0.9999;
  const x = easting - 250000;
  const y = northing;
  const e = Math.sqrt(1 - (b * b) / (a * a));
  const m = y / k0;
  const mu =
    m /
    (a * (1 - Math.pow(e, 2) / 4 - (3 * Math.pow(e, 4)) / 64 - (5 * Math.pow(e, 6)) / 256));
  const e1 = (1 - Math.sqrt(1 - e * e)) / (1 + Math.sqrt(1 - e * e));
  const fp =
    mu +
    ((3 * e1) / 2 - (27 * Math.pow(e1, 3)) / 32) * Math.sin(2 * mu) +
    ((21 * Math.pow(e1, 2)) / 16 - (55 * Math.pow(e1, 4)) / 32) * Math.sin(4 * mu);
  const e2 = Math.pow((e * a) / b, 2);
  const c1 = e2 * Math.pow(Math.cos(fp), 2);
  const t1 = Math.pow(Math.tan(fp), 2);
  const n1 = a / Math.sqrt(1 - Math.pow(e * Math.sin(fp), 2));
  const r1 = (a * (1 - e * e)) / Math.pow(1 - Math.pow(e * Math.sin(fp), 2), 1.5);
  const d = x / (n1 * k0);
  const q1 = (n1 * Math.tan(fp)) / r1;
  const lat =
    fp -
    q1 * (Math.pow(d, 2) / 2 - ((5 + 3 * t1 + 10 * c1 - 4 * Math.pow(c1, 2) - 9 * e2) * Math.pow(d, 4)) / 24);
  const lng =
    lng0 +
    (d - ((1 + 2 * t1 + c1) * Math.pow(d, 3)) / 6) / Math.cos(fp);
  return { lat: (lat * 180) / Math.PI, lng: (lng * 180) / Math.PI };
}

function toWgs(latRaw, lngRaw, xRaw, yRaw) {
  const lat = Number(latRaw);
  const lng = Number(lngRaw);
  if (Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180) {
    return { lat, lng, system: "EPSG:4326" };
  }
  const x = Number(xRaw);
  const y = Number(yRaw);
  if (Number.isFinite(x) && Number.isFinite(y) && x > 50000 && y > 1_500_000) {
    return { ...twd97ToWgs84(x, y), system: "TWD97" };
  }
  return null;
}

function parseOfficialFile(filePath) {
  const ext = extname(filePath).toLowerCase();
  const raw = readFileSync(filePath, "utf8");
  const rows = [];
  if (ext === ".json" || ext === ".geojson") {
    const json = JSON.parse(raw);
    const features = Array.isArray(json)
      ? json
      : Array.isArray(json.features)
        ? json.features
        : [];
    for (const item of features) {
      const props = item.properties || item;
      const coords = item.geometry?.coordinates;
      const geo = toWgs(
        props.lat ?? props.latitude ?? props.Y ?? props.y,
        props.lng ?? props.lon ?? props.longitude ?? props.X ?? props.x,
        coords?.[0] ?? props.X ?? props.x,
        coords?.[1] ?? props.Y ?? props.y,
      );
      rows.push({
        address: props.address || props.ADDRESS || props.門牌 || props.地址 || "",
        geo,
      });
    }
    return rows;
  }
  const lines = raw.replace(/^\uFEFF/, "").split(/\r?\n/).filter((line) => line.trim());
  if (lines.length < 2) return [];
  const headers = lines[0].split(",").map((item) => item.trim());
  const idx = (names) => headers.findIndex((h) => names.includes(h));
  const ai = idx(["地址", "門牌", "address", "ADDRESS", "full_address"]);
  const lati = idx(["lat", "latitude", "緯度", "Y", "y"]);
  const lngi = idx(["lng", "lon", "longitude", "經度", "X", "x"]);
  for (const line of lines.slice(1)) {
    const cols = line.split(",");
    rows.push({
      address: ai >= 0 ? cols[ai] : "",
      geo: toWgs(lati >= 0 ? cols[lati] : "", lngi >= 0 ? cols[lngi] : "", cols[lngi], cols[lati]),
    });
  }
  return rows;
}

function scanOfficialDir(dir) {
  const found = {};
  if (!dir || !existsSync(dir)) return found;
  for (const name of readdirSync(dir)) {
    const county = countyFromFilename(name);
    if (!county) continue;
    found[county] = join(dir, name);
  }
  return found;
}

const CHECKPOINT = "data/south-pilot/address-import-checkpoint.json";
const BATCH = Math.max(500, Math.min(1000, Number(process.env.ADDRESS_INDEX_BATCH || 800)));
const FAIL_STOP = 3;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function loadSouthIndex() {
  const path = existsSync("src/data/south-address-index.json.gz")
    ? "src/data/south-address-index.json.gz"
    : "data/south-pilot/address-index.json.gz";
  if (!existsSync(path)) return null;
  return JSON.parse(gunzipSync(readFileSync(path)).toString("utf8"));
}

function collectCloudRows(payload) {
  const wanted = new Set(SOUTH_ADDRESS_COUNTIES);
  const mapped = [];
  for (const row of payload.rows || []) {
    if (!wanted.has(row.c)) continue;
    if (!Number.isFinite(row.lat) || !Number.isFinite(row.lng)) continue;
    mapped.push(
      toAddressIndexRow(row, {
        version: payload.version,
        license: payload.license,
      }),
    );
  }
  return dedupeAddressRows(mapped);
}

function emptyCheckpoint() {
  return {
    version: "address-nlsc-beta",
    batch: 0,
    upserted: 0,
    failed: 0,
    consecutiveFails: 0,
    status: "idle",
    lastError: null,
    updatedAt: new Date().toISOString(),
  };
}

function saveCheckpoint(row) {
  mkdirSync("data/south-pilot", { recursive: true });
  const next = { ...row, updatedAt: new Date().toISOString() };
  writeFileSync(CHECKPOINT, `${JSON.stringify(next, null, 2)}\n`);
  return next;
}

async function upsertAddressBatch(config, rows) {
  return supabaseRest(config, "/rest/v1/taiwan_address_index?on_conflict=id", {
    method: "POST",
    headers: {
      Prefer: "resolution=merge-duplicates,return=minimal",
    },
    body: JSON.stringify(rows),
    timeoutMs: 60000,
  });
}

function ensureDerivedIndex() {
  const ready =
    existsSync("src/data/south-address-index.json.gz") ||
    existsSync("data/south-pilot/address-index.json.gz");
  if (ready) return { built: false, ready: true };
  const result = spawnSync(process.execPath, ["scripts/build-south-address-index.mjs"], {
    stdio: "inherit",
  });
  return { built: result.status === 0, ready: result.status === 0 };
}

async function importSouthAddresses(payload) {
  const rows = collectCloudRows(payload);
  const gate = cloudWriteGate({ source: payload.source || "nlsc-derived" });
  const config = readSupabaseConfig();
  if (!gate.ok) {
    return {
      wroteSupabase: false,
      dryRun: true,
      wouldUpsert: rows.length,
      reason: gate.reason,
      expectedUrl: EXPECTED_NAVPILOT_URL,
      expectedRef: EXPECTED_NAVPILOT_REF,
    };
  }
  if (!config.ok) {
    return {
      wroteSupabase: false,
      dryRun: true,
      wouldUpsert: rows.length,
      reason: config.reason,
    };
  }

  let checkpoint = existsSync(CHECKPOINT)
    ? JSON.parse(readFileSync(CHECKPOINT, "utf8"))
    : emptyCheckpoint();
  if (process.env.ADDRESS_INDEX_RESET === "1" || checkpoint.status === "idle") {
    checkpoint = emptyCheckpoint();
  }
  checkpoint.status = "running";
  saveCheckpoint(checkpoint);

  const start = checkpoint.upserted;
  const pending = rows.slice(start);
  let consecutiveFails = checkpoint.consecutiveFails || 0;
  for (let offset = 0; offset < pending.length; offset += BATCH) {
    const batch = pending.slice(offset, offset + BATCH);
    const result = await upsertAddressBatch(config, batch);
    if (!result.ok) {
      consecutiveFails += 1;
      checkpoint.failed += 1;
      checkpoint.consecutiveFails = consecutiveFails;
      checkpoint.lastError = result.text.slice(0, 240);
      checkpoint.status = "failed";
      saveCheckpoint(checkpoint);
      if (consecutiveFails >= FAIL_STOP) {
        return {
          wroteSupabase: checkpoint.upserted > 0,
          dryRun: false,
          upserted: checkpoint.upserted,
          failed: checkpoint.failed,
          reason: "consecutive_batch_failures",
          lastError: checkpoint.lastError,
        };
      }
      continue;
    }
    consecutiveFails = 0;
    checkpoint.consecutiveFails = 0;
    checkpoint.upserted += batch.length;
    checkpoint.batch += 1;
    checkpoint.status = "running";
    saveCheckpoint(checkpoint);
    await sleep(80);
  }

  const published = await countTable(
    config,
    "taiwan_address_index",
    "publish_status=eq.published",
  );
  const staging = await countTable(
    config,
    "taiwan_address_index",
    "publish_status=eq.staging",
  );
  const total = await countTable(config, "taiwan_address_index");
  checkpoint.status = "completed";
  saveCheckpoint(checkpoint);
  return {
    wroteSupabase: true,
    dryRun: false,
    upserted: checkpoint.upserted,
    failed: checkpoint.failed,
    reconcile: {
      total: total.count,
      staging: staging.count,
      published: published.count,
    },
  };
}

async function main() {
  mkdirSync("data/south-pilot", { recursive: true });
  const official = scanOfficialDir(DIR);
  let derived = { built: false, ready: existsSync("src/data/south-address-index.json.gz") };
  if (SOUTH.some((county) => !official[county])) {
    derived = ensureDerivedIndex();
  }

  const counties = COUNTIES.map((county) => {
    const file = official[county];
    if (file) {
      let total = 0;
      let withCoordinates = 0;
      let withoutCoordinates = 0;
      let failed = 0;
      try {
        const rows = parseOfficialFile(file);
        total = rows.length;
        for (const row of rows) {
          if (row.geo) withCoordinates += 1;
          else withoutCoordinates += 1;
        }
      } catch (error) {
        failed = 1;
        return {
          county,
          status: "official-file-failed",
          file,
          total,
          withCoordinates,
          withoutCoordinates,
          duplicates: 0,
          failed,
          error: error instanceof Error ? error.message : String(error),
        };
      }
      return {
        county,
        status: "official-county-file",
        file,
        total,
        withCoordinates,
        withoutCoordinates,
        duplicates: 0,
        failed,
      };
    }
    if (SOUTH.includes(county) && derived.ready) {
      return {
        county,
        status: "nlsc-derived",
        file: "src/data/south-address-index.json.gz",
        total: null,
        withCoordinates: null,
        withoutCoordinates: 0,
        duplicates: 0,
        failed: 0,
        note: "本機 staging／Beta，不是各縣市合法門牌原始檔。",
      };
    }
    return {
      county,
      status: "NOT CONFIGURED",
      total: 0,
      withCoordinates: 0,
      withoutCoordinates: 0,
      duplicates: 0,
      failed: 0,
    };
  });

  const payload = loadSouthIndex();
  const cloudRows = payload ? collectCloudRows(payload) : [];
  const cloud = payload
    ? await importSouthAddresses(payload)
    : { wroteSupabase: false, dryRun: true, wouldUpsert: 0, reason: "missing_local_index" };

  const officialCount = counties.filter((row) => row.status === "official-county-file").length;
  const derivedCount = counties.filter((row) => row.status === "nlsc-derived").length;
  const missingCount = counties.filter((row) => row.status === "NOT CONFIGURED").length;

  const report = {
    dataset: "各縣市合法門牌公開資料",
    status:
      officialCount === COUNTIES.length
        ? "official-county-file"
        : officialCount || derivedCount
          ? "partial"
          : "NOT CONFIGURED",
    dryRun: !cloud.wroteSupabase,
    addressDoorplatesDir: DIR || null,
    officialCounties: officialCount,
    nlscDerivedCounties: derivedCount,
    notConfiguredCounties: missingCount,
    source: payload?.source || null,
    notOfficialCountyFile: payload?.notOfficialCountyFile !== false,
    wouldUpsert: cloud.wouldUpsert ?? cloudRows.length,
    cloud,
    wroteSupabase: Boolean(cloud.wroteSupabase),
    counties,
    notes: [
      "缺官方檔的縣市不會被其他縣市擋住。",
      "nlsc-derived 不得標成官方合法門牌。",
      "寫入需 ADDRESS_INDEX_APPLY=1、ADDRESS_INDEX_ALLOW_NLSC_DERIVED=1、NAVPILOT_SUPABASE_PROJECT_REF=rxzbsthsqlozxgctdoks。",
      "第一階段雲端列預設 publish_status=staging。",
    ],
  };

  writeFileSync("docs/address-import-doorplates-report.json", `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify(report, null, 2));

  if (process.env.ADDRESS_INDEX_APPLY === "1" && !cloud.wroteSupabase) {
    console.error(`DATASET NOT IMPORTED: ${cloud.reason || "cloud write blocked"}`);
    process.exit(2);
  }
}

void main();
