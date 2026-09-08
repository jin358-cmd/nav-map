#!/usr/bin/env node
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";

const GZ = "src/data/taiwan-poi-index.json.gz";
const JSON_PATH = "src/data/taiwan-poi-index.json";
const CHECKPOINT = "src/data/poi-ingest-checkpoint.json";
const OUT = "docs/poi-import-status.json";

function loadRows() {
  if (existsSync(GZ)) {
    return JSON.parse(gunzipSync(readFileSync(GZ)).toString("utf8"));
  }
  if (existsSync(JSON_PATH)) {
    return JSON.parse(readFileSync(JSON_PATH, "utf8"));
  }
  return [];
}

function loadCheckpoint() {
  if (!existsSync(CHECKPOINT)) return null;
  try {
    return JSON.parse(readFileSync(CHECKPOINT, "utf8"));
  } catch {
    return null;
  }
}

const rows = loadRows();
const active = rows.filter((row) => row.isActive !== false);
const inactive = rows.length - active.length;
const missingCoord = rows.filter(
  (row) => !Number.isFinite(Number(row.latitude)) || !Number.isFinite(Number(row.longitude)),
).length;
const byCity = {};
const byCategory = {};
const byBrand = {};
for (const row of active) {
  const city = row.city || row.county || "未知";
  byCity[city] = (byCity[city] ?? 0) + 1;
  byCategory[row.category || "other"] = (byCategory[row.category || "other"] ?? 0) + 1;
  if (row.brand) byBrand[row.brand] = (byBrand[row.brand] ?? 0) + 1;
}
const checkpoint = loadCheckpoint();
const report = {
  expectedFromLastIngest: 135802,
  dbTotal: rows.length,
  active: active.length,
  inactive,
  missingCoordinate: missingCoord,
  duplicateIds: rows.length - new Set(rows.map((row) => row.id)).size,
  lastSuccessfulBatch: checkpoint?.lastSuccessfulBatch ?? null,
  incompleteBatch: checkpoint?.status === "failed" || checkpoint?.status === "in_progress",
  checkpointStatus: checkpoint?.status ?? "none",
  resumeOffset: checkpoint?.resumeOffset ?? null,
  failureReason: checkpoint?.failureReason ?? null,
  batchSizeDefault: 1000,
  byCity,
  byCategory,
  brandCount: Object.keys(byBrand).length,
  verifiedAt: new Date().toISOString(),
};
writeFileSync(OUT, `${JSON.stringify(report, null, 2)}\n`);
console.log(
  JSON.stringify(
    {
      dbTotal: report.dbTotal,
      active: report.active,
      incompleteBatch: report.incompleteBatch,
      checkpointStatus: report.checkpointStatus,
    },
    null,
    2,
  ),
);
