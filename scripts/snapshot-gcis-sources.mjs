#!/usr/bin/env node
/** Persist a reproducible GCIS input snapshot without modifying the POI index. */

import { createHash } from "node:crypto";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { basename, dirname, resolve } from "node:path";
import { industryFromTitle } from "./gcis-yellow-pages.mjs";

const VERSION = process.env.GCIS_SNAPSHOT_VERSION || "south-pilot-20260920-rebuild1";
const ROOT = resolve(process.env.GCIS_SNAPSHOT_DIR || `data/source-snapshots/${VERSION}`);
const DATA_DIR = resolve(ROOT, "gcis");
const MANIFEST_PATH = resolve(ROOT, "source-snapshot-manifest.json");
const FILE_MAP_PATH = "src/data/gcis-dataset-files.json";
const BASE_POI_PATH = "src/data/taiwan-poi-index.json.gz";
const CATALOG_URL = "https://data.gcis.nat.gov.tw/od/datacategory";
const LIMIT = Math.max(0, Number(process.env.GCIS_SNAPSHOT_LIMIT || 0));
const CONCURRENCY = Math.max(1, Math.min(8, Number(process.env.GCIS_SNAPSHOT_CONCURRENCY || 3)));
const USER_AGENT = "NavPilot/0.1 source snapshot (https://github.com/jin358-cmd/nav-map)";

function sha256(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function parseCatalog(html) {
  return [...html.matchAll(/href="\/od\/detail[^"]*\?oid=([0-9A-Fa-f-]{36})"[^>]*>([^<]+)/g)].map(
    (match) => ({ oid: match[1], title: match[2].trim() }),
  );
}

function saveManifest(manifest) {
  const temp = `${MANIFEST_PATH}.tmp`;
  writeFileSync(temp, `${JSON.stringify(manifest, null, 2)}\n`);
  if (existsSync(MANIFEST_PATH)) {
    writeFileSync(MANIFEST_PATH, readFileSync(temp));
  } else {
    renameSync(temp, MANIFEST_PATH);
    return;
  }
  unlinkSync(temp);
}

async function fetchBuffer(url, timeoutMs = 180_000) {
  let lastError;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(url, {
        headers: { "User-Agent": USER_AGENT },
        redirect: "follow",
        signal: controller.signal,
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return {
        bytes: Buffer.from(await response.arrayBuffer()),
        contentType: response.headers.get("content-type"),
        etag: response.headers.get("etag"),
        lastModified: response.headers.get("last-modified"),
      };
    } catch (error) {
      lastError = error;
      if (attempt < 3) await new Promise((resolvePromise) => setTimeout(resolvePromise, attempt * 500));
    } finally {
      clearTimeout(timer);
    }
  }
  throw lastError;
}

async function main() {
  mkdirSync(DATA_DIR, { recursive: true });
  const startedAt = new Date().toISOString();
  const fileMap = JSON.parse(readFileSync(FILE_MAP_PATH, "utf8"));
  const entries = Object.entries(fileMap).sort(([a], [b]) => a.localeCompare(b));
  const selected = LIMIT > 0 ? entries.slice(0, LIMIT) : entries;
  const previous = existsSync(MANIFEST_PATH)
    ? JSON.parse(readFileSync(MANIFEST_PATH, "utf8"))
    : null;
  const manifest = {
    schemaVersion: 1,
    version: VERSION,
    status: "in-progress",
    startedAt: previous?.startedAt || startedAt,
    updatedAt: startedAt,
    completedAt: null,
    catalog: previous?.catalog || null,
    fileMap: {
      path: FILE_MAP_PATH,
      sha256: sha256(FILE_MAP_PATH),
      count: entries.length,
    },
    basePoi: previous?.basePoi || null,
    datasets: previous?.datasets || {},
    failures: previous?.failures || {},
    totals: { expected: entries.length, selected: selected.length, completed: 0, bytes: 0 },
    notes: [
      "This directory is persistent workspace data and is intentionally excluded from Git.",
      "NLSC response provenance is recorded separately during the geocoding stage.",
    ],
  };

  const catalogPath = resolve(ROOT, "gcis-catalog.html");
  if (!existsSync(catalogPath)) {
    const catalog = await fetchBuffer(CATALOG_URL);
    writeFileSync(catalogPath, catalog.bytes);
  }
  const catalogItems = parseCatalog(readFileSync(catalogPath, "utf8"));
  const wantedDatasets = catalogItems.filter((item) => industryFromTitle(item.title));
  const wantedOids = new Set(wantedDatasets.map((item) => item.oid));
  const mappedOids = new Set(entries.map(([oid]) => oid));
  const missingMappings = [...wantedOids].filter((oid) => !mappedOids.has(oid));
  const extraMappings = [...mappedOids].filter((oid) => !wantedOids.has(oid));
  if (missingMappings.length || extraMappings.length) {
    throw new Error(
      `catalog_file_map_mismatch missing=${missingMappings.length} extra=${extraMappings.length}`,
    );
  }
  manifest.catalog = {
    url: CATALOG_URL,
    path: catalogPath,
    bytes: statSync(catalogPath).size,
    sha256: sha256(catalogPath),
    totalDatasets: catalogItems.length,
    selectedDatasets: wantedDatasets.length,
    industryDefinitions: new Set(wantedDatasets.map((item) => industryFromTitle(item.title)?.title)).size,
  };

  const baseTarget = resolve(ROOT, "base", basename(BASE_POI_PATH));
  mkdirSync(dirname(baseTarget), { recursive: true });
  if (!existsSync(baseTarget)) copyFileSync(BASE_POI_PATH, baseTarget);
  manifest.basePoi = {
    sourcePath: BASE_POI_PATH,
    archivedPath: baseTarget,
    bytes: statSync(baseTarget).size,
    sha256: sha256(baseTarget),
  };
  saveManifest(manifest);

  let cursor = 0;
  async function worker() {
    while (cursor < selected.length) {
      const index = cursor;
      cursor += 1;
      const [oid, relativeUrl] = selected[index];
      const url = `https://data.gcis.nat.gov.tw${relativeUrl}`;
      const destination = resolve(DATA_DIR, `${oid}.csv`);
      const existing = manifest.datasets[oid];
      if (existsSync(destination) && existing?.sha256 === sha256(destination)) {
        console.log(`[snapshot] reuse ${index + 1}/${selected.length} ${oid}`);
        continue;
      }
      console.log(`[snapshot] download ${index + 1}/${selected.length} ${oid}`);
      try {
        const result = await fetchBuffer(url);
        const partial = `${destination}.part`;
        writeFileSync(partial, result.bytes);
        renameSync(partial, destination);
        manifest.datasets[oid] = {
          url,
          path: destination,
          bytes: result.bytes.length,
          sha256: sha256(destination),
          contentType: result.contentType,
          etag: result.etag,
          lastModified: result.lastModified,
          downloadedAt: new Date().toISOString(),
        };
        delete manifest.failures[oid];
        manifest.updatedAt = new Date().toISOString();
        saveManifest(manifest);
      } catch (error) {
        manifest.status = "partial";
        manifest.failures[oid] = {
          url,
          message: error instanceof Error ? error.message : String(error),
          failedAt: new Date().toISOString(),
        };
        manifest.updatedAt = new Date().toISOString();
        saveManifest(manifest);
        console.error(`[snapshot] failed ${index + 1}/${selected.length} ${oid}: ${manifest.failures[oid].message}`);
      }
    }
  }

  await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()));
  const records = Object.values(manifest.datasets);
  manifest.totals = {
    expected: entries.length,
    selected: selected.length,
    completed: records.length,
    bytes: records.reduce((sum, row) => sum + Number(row.bytes || 0), 0),
  };
  const failureCount = Object.keys(manifest.failures).length;
  const complete = LIMIT === 0 && records.length === entries.length && failureCount === 0;
  manifest.status = complete ? "completed" : "partial";
  manifest.completedAt = complete ? new Date().toISOString() : null;
  manifest.updatedAt = new Date().toISOString();
  manifest.totals.failed = failureCount;
  delete manifest.failure;
  saveManifest(manifest);
  console.log(JSON.stringify({ root: ROOT, status: manifest.status, totals: manifest.totals }, null, 2));
}

main().catch((error) => {
  console.error(JSON.stringify({ stop: true, reason: "snapshot_failed", error: error instanceof Error ? error.message : String(error) }));
  process.exit(1);
});