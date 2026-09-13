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
import { COUNTIES } from "./gcis-address.mjs";

const SOUTH = ["雲林縣", "嘉義市", "嘉義縣", "臺南市", "高雄市", "屏東縣"];
const dryRun = !process.argv.includes("--apply");
const DIR = process.env.ADDRESS_DOORPLATES_DIR || "";
const APPLY_CLOUD = process.env.ADDRESS_INDEX_APPLY === "1";

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

function supabaseConfig() {
  const url = (process.env.SUPABASE_URL || "").replace(/\/$/, "");
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  if (!url || !key) return null;
  if (/gvg|rent|rental|租屋/i.test(url)) {
    throw new Error("拒絕寫入疑似 GVG／租屋雷達專案。");
  }
  return { url, key };
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

function main() {
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
        note: "本機 staging，不是各縣市合法門牌原始檔。",
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

  const supabase = supabaseConfig();
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
    dryRun,
    addressDoorplatesDir: DIR || null,
    officialCounties: officialCount,
    nlscDerivedCounties: derivedCount,
    notConfiguredCounties: missingCount,
    supabaseConfigured: Boolean(supabase),
    wroteSupabase: false,
    counties,
    notes: [
      "缺官方檔的縣市不會被其他縣市擋住。",
      "nlsc-derived 不得標成官方合法門牌。",
      "未確認 NavPilot Supabase 前不寫 taiwan_address_index。",
    ],
  };

  writeFileSync("address-import-doorplates-report.json", `${JSON.stringify(report, null, 2)}\n`);
  writeFileSync("docs/address-import-doorplates-report.json", `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify(report, null, 2));

  if (!dryRun && APPLY_CLOUD) {
    if (!supabase) {
      console.error("DATASET NOT IMPORTED: NavPilot Supabase 未確認，拒絕寫入 taiwan_address_index。");
      process.exit(2);
    }
    console.error("DATASET NOT IMPORTED: cloud apply is blocked until the project ref is confirmed in chat.");
    process.exit(2);
  }
  if (!dryRun && officialCount === 0 && derivedCount === 0) {
    console.error("DATASET NOT IMPORTED: no licensed county doorplate files configured.");
    process.exit(2);
  }
}

main();
