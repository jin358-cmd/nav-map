#!/usr/bin/env node
/**
 * Southern POI upsert. Default is dry-run (no network writes).
 * Live write requires SOUTH_POI_APPLY=1 and SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY.
 * Never uses NEXT_PUBLIC_ service keys. Never truncate/drop.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { DATA_VERSION, SOUTH_PILOT_REGIONS } from "./south-poi-shared.mjs";

const APPLY = process.env.SOUTH_POI_APPLY === "1";
const CHECKPOINT = "data/south-pilot/import-checkpoint.json";
const BATCH = Math.max(1000, Math.min(5000, Number(process.env.SOUTH_POI_BATCH || 3000)));

function loadSummary() {
  const path = "data/south-pilot/summary.json";
  if (!existsSync(path)) {
    throw new Error("先跑 node scripts/export-south-pois.mjs");
  }
  return JSON.parse(readFileSync(path, "utf8"));
}

function config() {
  const url = (process.env.SUPABASE_URL || "").replace(/\/$/, "");
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  if (!url || !key) return null;
  if (/gvg|rent|rental|租屋/i.test(url)) {
    throw new Error("拒絕寫入疑似 GVG／租屋雷達專案。請確認 NavPilot 專用 Supabase。");
  }
  return { url, key };
}

function emptyCheckpoint() {
  return {
    version: DATA_VERSION,
    batch: 0,
    upserted: 0,
    failed: 0,
    consecutiveFails: 0,
    status: "idle",
    updatedAt: new Date().toISOString(),
  };
}

function main() {
  const summary = loadSummary();
  const supabase = config();
  mkdirSync("data/south-pilot", { recursive: true });
  const prev = existsSync(CHECKPOINT)
    ? JSON.parse(readFileSync(CHECKPOINT, "utf8"))
    : emptyCheckpoint();

  if (!APPLY) {
    const report = {
      mode: "dry-run",
      dataVersion: DATA_VERSION,
      regions: SOUTH_PILOT_REGIONS,
      wouldUpsert: summary.actual.located,
      wouldPublish: summary.actual.published,
      batches: summary.estimatedUpsertBatches,
      batchSize: BATCH,
      supabaseConfigured: Boolean(supabase),
      resumeFrom: prev.status === "running" ? prev.batch : 0,
      note: "未設定 SOUTH_POI_APPLY=1，沒有寫入任何資料表。",
    };
    writeFileSync(CHECKPOINT, `${JSON.stringify({ ...prev, status: "dry-run", updatedAt: new Date().toISOString() }, null, 2)}\n`);
    console.log(JSON.stringify(report, null, 2));
    return;
  }

  if (!supabase) {
    console.error(
      JSON.stringify({
        stop: true,
        reason: "supabase_unconfirmed",
        need: ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"],
        hint: "未確認 NavPilot 專用專案前不得寫入。未授權費用的新專案不得自行建立。",
      }),
    );
    process.exit(2);
  }

  console.error(
    JSON.stringify({
      stop: true,
      reason: "apply_blocked_until_project_confirmed",
      message:
        "此環境沒有已確認的 NavPilot Supabase 專案。請人工提供專案 ref 後再以 SOUTH_POI_APPLY=1 續跑。",
    }),
  );
  process.exit(2);
}

main();
