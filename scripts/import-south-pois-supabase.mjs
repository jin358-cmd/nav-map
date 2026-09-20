#!/usr/bin/env node
/**
 * Southern POI upsert. Default is dry-run (no network writes).
 * Live write requires:
 *   SOUTH_POI_APPLY=1
 *   SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY
 *   NAVPILOT_SUPABASE_PROJECT_REF matching the URL hostname
 * Never uses NEXT_PUBLIC_ service keys. Never truncate/drop.
 * Resume via data/south-pilot/import-checkpoint.json.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import {
  DATA_VERSION,
  SOUTH_PILOT_REGIONS,
  collectSouthPoiRows,
  loadPoiRows,
  parseCountyList,
  resolveSouthPoiIndex,
  toSupabasePoiRow,
} from "./south-poi-shared.mjs";
import {
  applyBlockedReason,
  countTable,
  isProjectConfirmed,
  readSupabaseConfig,
  supabaseRest,
} from "./supabase-navpilot.mjs";

const APPLY = process.env.SOUTH_POI_APPLY === "1";
const CHECKPOINT = "data/south-pilot/import-checkpoint.json";
const BATCH = Math.max(500, Math.min(5000, Number(process.env.SOUTH_POI_BATCH || 1000)));
const MAX_BATCHES = Math.max(0, Number(process.env.SOUTH_POI_MAX_BATCHES || 0));
const PUBLISHED_ONLY = process.env.SOUTH_POI_PUBLISHED_ONLY === "1";
const SLEEP_MS = Math.max(0, Number(process.env.SOUTH_POI_SLEEP_MS || 120));
const FAIL_STOP = Math.max(1, Number(process.env.SOUTH_POI_FAIL_STOP || 3));

function loadSummary() {
  const path = "data/south-pilot/summary.json";
  if (!existsSync(path)) {
    throw new Error("先跑 node scripts/export-south-pois.mjs");
  }
  return JSON.parse(readFileSync(path, "utf8"));
}

function emptyCheckpoint(extra = {}) {
  return {
    version: DATA_VERSION,
    jobId: extra.jobId || null,
    counties: extra.counties || [...SOUTH_PILOT_REGIONS],
    publishedOnly: PUBLISHED_ONLY,
    batchSize: BATCH,
    batch: 0,
    upserted: 0,
    failed: 0,
    consecutiveFails: 0,
    byCounty: {},
    status: "idle",
    lastError: null,
    omitGeom: false,
    updatedAt: new Date().toISOString(),
  };
}

function saveCheckpoint(row) {
  mkdirSync("data/south-pilot", { recursive: true });
  const next = { ...row, updatedAt: new Date().toISOString() };
  writeFileSync(CHECKPOINT, `${JSON.stringify(next, null, 2)}\n`);
  return next;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function loadCheckpoint(counties) {
  if (!existsSync(CHECKPOINT)) return emptyCheckpoint({ counties });
  const prev = JSON.parse(readFileSync(CHECKPOINT, "utf8"));
  const sameJob =
    prev.version === DATA_VERSION &&
    JSON.stringify(prev.counties || []) === JSON.stringify(counties) &&
    Boolean(prev.publishedOnly) === PUBLISHED_ONLY &&
    prev.batchSize === BATCH &&
    (prev.status === "running" || prev.status === "paused" || prev.status === "failed");
  if (sameJob && process.env.SOUTH_POI_RESET !== "1") return prev;
  return emptyCheckpoint({ counties });
}

async function upsertBatch(config, rows, omitGeom) {
  const payload = rows.map((row) => {
    const body = toSupabasePoiRow(row);
    if (omitGeom) delete body.geom;
    return body;
  });
  const result = await supabaseRest(config, "/rest/v1/taiwan_poi_index?on_conflict=source,source_id", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify(payload),
    timeoutMs: 60000,
  });
  if (!result.ok && !omitGeom && /geom|parse|EWKT|geography/i.test(result.text)) {
    return upsertBatch(config, rows, true);
  }
  return { ...result, omitGeom };
}

async function startRun(config, checkpoint) {
  const body = [
    {
      job_id: checkpoint.jobId,
      data_version: DATA_VERSION,
      region: checkpoint.counties.join(","),
      batch_count: 0,
      success_count: 0,
      fail_count: 0,
      status: "running",
    },
  ];
  const result = await supabaseRest(config, "/rest/v1/poi_import_runs", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify(body),
  });
  const id = Array.isArray(result.json) ? result.json[0]?.id : null;
  return id || null;
}

async function finishRun(config, runId, checkpoint) {
  if (!runId) return;
  await supabaseRest(config, `/rest/v1/poi_import_runs?id=eq.${runId}`, {
    method: "PATCH",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({
      finished_at: new Date().toISOString(),
      batch_count: checkpoint.batch,
      success_count: checkpoint.upserted,
      fail_count: checkpoint.failed,
      status: checkpoint.status,
    }),
  });
}

async function writeDataVersion(config, published) {
  await supabaseRest(config, "/rest/v1/poi_data_versions?on_conflict=version", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify([
      {
        version: DATA_VERSION,
        license: "OGDL-Taiwan-1.0",
        generated_at: new Date().toISOString(),
        total: published,
        hash: DATA_VERSION,
        is_current: true,
      },
    ]),
  });
}

async function reconcile(config, expectedPublished) {
  const published = await countTable(
    config,
    "taiwan_poi_index",
    `data_version=eq.${encodeURIComponent(DATA_VERSION)}&publish_status=eq.published&nav_ready=eq.true`,
  );
  return {
    ok: published.ok && published.count === expectedPublished,
    expectedPublished,
    cloudPublished: published.count,
    status: published.status,
    detail: published.text.slice(0, 160),
  };
}

async function main() {
  const summary = loadSummary();
  const source = resolveSouthPoiIndex(summary?.sourceSha256 || null);
  const INDEX = source.path;
  const countyArg = process.argv.find((item) => item.startsWith("--county="))?.slice("--county=".length);
  const parsed = parseCountyList(process.env.SOUTH_POI_COUNTIES || countyArg || "");
  if (parsed.unknown.length) {
    console.error(JSON.stringify({ stop: true, reason: "unknown_county", unknown: parsed.unknown }));
    process.exit(2);
  }
  const counties = parsed.selected;
  const supabase = readSupabaseConfig();
  mkdirSync("data/south-pilot", { recursive: true });
  const prev = loadCheckpoint(counties);

  if (!INDEX) {
    console.error(JSON.stringify({ stop: true, reason: "missing_source_index", expectedSha: summary.sourceSha256 }));
    process.exit(2);
  }

  const allRows = collectSouthPoiRows(loadPoiRows(INDEX), counties);
  const rows = PUBLISHED_ONLY
    ? allRows.filter((row) => row.publishStatus === "published")
    : allRows;
  const actualByCounty = Object.fromEntries(
    counties.map((county) => {
      const countyRows = allRows.filter((row) => row.county === county);
      return [
        county,
        {
          located: countyRows.length,
          published: countyRows.filter((row) => row.publishStatus === "published").length,
          review: countyRows.filter((row) => row.publishStatus === "review").length,
        },
      ];
    }),
  );
  const summaryByCounty = Object.fromEntries(
    counties.map((county) => [
      county,
      {
        located: Number(summary.byCounty?.[county]?.located || 0),
        published: Number(summary.byCounty?.[county]?.published || 0),
        review: Number(summary.byCounty?.[county]?.review || 0),
      },
    ]),
  );
  const summaryMatches = counties.every(
    (county) =>
      actualByCounty[county].located === summaryByCounty[county].located &&
      actualByCounty[county].published === summaryByCounty[county].published &&
      actualByCounty[county].review === summaryByCounty[county].review,
  );

  if (!APPLY) {
    const report = {
      mode: "dry-run",
      dataVersion: DATA_VERSION,
      regions: counties,
      publishedOnly: PUBLISHED_ONLY,
      sourcePath: INDEX,
      sourceSha256: source.sha256,
      sourceMatched: source.matched,
      wouldUpsert: rows.length,
      wouldPublish: rows.filter((row) => row.publishStatus === "published").length,
      byCounty: actualByCounty,
      summaryByCounty,
      summaryMatches,
      wroteSupabase: false,
      batchSize: BATCH,
      estimatedBatches: null,
      supabaseConfigured: supabase.ok,
      projectConfirmed: isProjectConfirmed(supabase),
      blockedReason: applyBlockedReason(supabase),
      resumeFrom: prev.status === "running" || prev.status === "paused" ? prev.batch : 0,
      note: "未設定 SOUTH_POI_APPLY=1，沒有寫入任何資料表。",
    };
    report.estimatedBatches = Math.ceil((report.wouldUpsert || 1) / BATCH);
    saveCheckpoint({ ...prev, status: "dry-run", counties });
    console.log(JSON.stringify(report, null, 2));
    return;
  }

  if (!summaryMatches) {
    console.error(
      JSON.stringify({
        stop: true,
        reason: "source_count_mismatch",
        actualByCounty,
        summaryByCounty,
      }),
    );
    process.exit(2);
  }

  const blocked = applyBlockedReason(supabase);
  if (blocked) {
    const message =
      blocked === "forbidden_project"
        ? "拒絕寫入疑似 GVG／租屋雷達專案。"
        : blocked === "project_ref_unconfirmed"
          ? "請在聊天中提供 NavPilot 專案 ref，並設 NAVPILOT_SUPABASE_PROJECT_REF 與 URL 主機名一致後再跑。"
          : "未確認 NavPilot 專用專案前不得寫入。未授權費用的新專案不得自行建立。";
    console.error(
      JSON.stringify({
        stop: true,
        reason: blocked,
        need: ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "NAVPILOT_SUPABASE_PROJECT_REF"],
        hint: message,
      }),
    );
    saveCheckpoint({ ...prev, status: "blocked", lastError: blocked, counties });
    process.exit(2);
  }

  const expectedPublish = allRows.filter((row) => row.publishStatus === "published").length;
  const ping = await countTable(supabase, "taiwan_poi_index");
  if (ping.status === 404 || ping.status === 0) {
    console.error(
      JSON.stringify({
        stop: true,
        reason: "schema_missing",
        status: ping.status,
        hint: "NavPilot schema 應對齊遠端 20260916085144…20260916085221；Advisor 修正 20260917234436 需人工確認後才 db push",
      }),
    );
    process.exit(2);
  }

  let checkpoint = {
    ...loadCheckpoint(counties),
    jobId: prev.jobId || `south-pilot-${counties.join("-")}-${Date.now()}`,
    counties,
    publishedOnly: PUBLISHED_ONLY,
    batchSize: BATCH,
    status: "running",
    lastError: null,
  };
  if (checkpoint.batch * BATCH >= rows.length && checkpoint.upserted > 0) {
    checkpoint.status = "completed";
    saveCheckpoint(checkpoint);
  } else {
    const runId = await startRun(supabase, checkpoint);
    let omitGeom = Boolean(checkpoint.omitGeom);
    const startBatch = checkpoint.batch;
    const limit = MAX_BATCHES > 0 ? startBatch + MAX_BATCHES : Number.POSITIVE_INFINITY;
    for (let batch = startBatch; batch * BATCH < rows.length && batch < limit; batch += 1) {
      const slice = rows.slice(batch * BATCH, batch * BATCH + BATCH);
      const result = await upsertBatch(supabase, slice, omitGeom);
      omitGeom = result.omitGeom || omitGeom;
      if (result.ok) {
        checkpoint.upserted += slice.length;
        checkpoint.consecutiveFails = 0;
        checkpoint.lastError = null;
        for (const row of slice) {
          checkpoint.byCounty[row.county] = checkpoint.byCounty[row.county] || { upserted: 0, failed: 0 };
          checkpoint.byCounty[row.county].upserted += 1;
        }
      } else {
        checkpoint.failed += slice.length;
        checkpoint.consecutiveFails += 1;
        checkpoint.lastError = `${result.status} ${result.text}`.trim();
        for (const row of slice) {
          checkpoint.byCounty[row.county] = checkpoint.byCounty[row.county] || { upserted: 0, failed: 0 };
          checkpoint.byCounty[row.county].failed += 1;
        }
      }
      checkpoint.batch = batch + 1;
      checkpoint.omitGeom = omitGeom;
      saveCheckpoint(checkpoint);
      if (checkpoint.consecutiveFails >= FAIL_STOP) {
        checkpoint.status = "failed";
        saveCheckpoint(checkpoint);
        await finishRun(supabase, runId, checkpoint);
        console.error(
          JSON.stringify({
            stop: true,
            reason: "consecutive_fail_stop",
            consecutiveFails: checkpoint.consecutiveFails,
            lastError: checkpoint.lastError,
            checkpoint: CHECKPOINT,
          }),
        );
        process.exit(1);
      }
      if (SLEEP_MS) await sleep(SLEEP_MS);
    }
    const done = checkpoint.batch * BATCH >= rows.length;
    checkpoint.status = done ? "completed" : "paused";
    saveCheckpoint(checkpoint);
    if (done) {
      await writeDataVersion(supabase, expectedPublish);
      const check = await reconcile(supabase, expectedPublish);
      if (!check.ok) {
        checkpoint.status = "mismatch";
        checkpoint.lastError = `cloudPublished=${check.cloudPublished} expected=${check.expectedPublished}`;
        saveCheckpoint(checkpoint);
        await finishRun(supabase, runId, checkpoint);
        console.error(JSON.stringify({ stop: true, reason: "count_mismatch", ...check }));
        process.exit(1);
      }
    }
    await finishRun(supabase, runId, checkpoint);
  }

  console.log(
    JSON.stringify(
      {
        mode: "apply",
        dataVersion: DATA_VERSION,
        counties,
        publishedOnly: PUBLISHED_ONLY,
        rows: rows.length,
        wroteSupabase: true,
        checkpoint,
        expectedPublish,
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(
    JSON.stringify({
      stop: true,
      reason: error?.code || "import_crash",
      error: error instanceof Error ? error.message : String(error),
      details: error?.details,
    }),
  );
  process.exit(1);
});
