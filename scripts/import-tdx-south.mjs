import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import nextEnv from "@next/env";
import {
  SOUTH_REGIONS,
  deduplicate,
  normalizeParkingRow,
} from "./tdx-import-shared.mjs";

const { loadEnvConfig } = nextEnv;
loadEnvConfig(process.cwd());

const API_BASE = "https://tdx.transportdata.tw/api/basic";
const TOKEN_URL = "https://tdx.transportdata.tw/auth/realms/TDXConnect/protocol/openid-connect/token";
const dataset = "parking_offstreet_carpark";
const sourceVersion = "TDX-v1";
const batchSize = Math.max(1, Math.min(Number(process.env.TDX_BATCH_SIZE) || 250, 1000));
const apply = process.env.TDX_SOUTH_APPLY === "1" && !process.argv.includes("--dry-run");
const fixtureArg = process.argv.find((value) => value.startsWith("--fixture="));
const fixturePath = fixtureArg ? path.resolve(fixtureArg.slice("--fixture=".length)) : null;
const stateDir = path.join(process.cwd(), "data", "tdx-south");
const checkpointPath = path.join(stateDir, "checkpoint.json");
const rejectsPath = path.join(stateDir, "rejects.jsonl");
const reportPath = path.join(stateDir, "last-report.json");

if (apply && (!process.env.SUPABASE_URL?.trim() || !process.env.SUPABASE_SERVICE_ROLE_KEY?.trim())) {
  throw new Error("Supabase server credentials are required when TDX_SOUTH_APPLY=1");
}

const selectedIds = new Set(
  (process.env.TDX_SOUTH_REGIONS || SOUTH_REGIONS.map(([id]) => id).join(","))
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean),
);
const regions = SOUTH_REGIONS.filter(([id]) => selectedIds.has(id));
if (!regions.length) throw new Error("TDX_SOUTH_REGIONS does not contain a south region");

await fs.mkdir(stateDir, { recursive: true });
const previous = await readJson(checkpointPath, null);
const resuming = previous?.status === "running" || previous?.status === "failed";
const jobId = resuming
  ? previous.job_id
  : `tdx-south-${new Date().toISOString().replace(/[:.]/g, "-")}`;
const startedAt = resuming
  ? previous?.started_at || new Date().toISOString()
  : new Date().toISOString();
const report = {
  job_id: jobId,
  source: "tdx",
  source_version: sourceVersion,
  dataset,
  regions: regions.map(([id]) => id),
  batch_size: batchSize,
  apply,
  fetched: 0,
  accepted: 0,
  rejected: 0,
  duplicates: 0,
  failures: 0,
  processed_count: resuming ? previous?.processed_count || 0 : 0,
  success_count: resuming ? previous?.success_count || 0 : 0,
  failed_count: resuming ? previous?.failed_count || 0 : 0,
  last_checkpoint: resuming ? previous?.last_checkpoint || 0 : 0,
  started_at: startedAt,
  updated_at: new Date().toISOString(),
  completed_at: null,
  status: "running",
};

let token = null;
let fixture = null;
if (fixturePath) fixture = await readJson(fixturePath, {});

try {
  await persistCheckpoint();
  const resumeRegionIndex = resuming
    ? Math.max(0, regions.findIndex(([id]) => id === previous?.region))
    : 0;
  for (let regionIndex = resumeRegionIndex; regionIndex < regions.length; regionIndex += 1) {
    const [region, city] = regions[regionIndex];
    const rawRows = fixture ? fixture[region] || [] : await fetchAllParking(region);
    report.fetched += rawRows.length;
    const normalized = rawRows.map((row) =>
      normalizeParkingRow(row, {
        region,
        city,
        fetchedAt: new Date().toISOString(),
        sourceVersion,
      }),
    );
    const unique = deduplicate(normalized);
    report.duplicates += unique.duplicates;
    const start = resuming && previous?.region === region ? previous.region_offset || 0 : 0;
    for (let offset = start; offset < unique.records.length; offset += batchSize) {
      const page = unique.records.slice(offset, offset + batchSize);
      const accepted = page.filter((row) => row.normalization_status === "accepted");
      const rejected = page.filter((row) => row.normalization_status === "rejected");
      report.accepted += accepted.length;
      report.rejected += rejected.length;
      if (rejected.length) {
        await fs.appendFile(
          rejectsPath,
          `${rejected.map((row) => JSON.stringify({ job_id: jobId, ...row })).join("\n")}\n`,
          "utf8",
        );
      }
      if (apply) await stageBatch(page);
      report.processed_count += page.length;
      report.success_count += accepted.length;
      report.failed_count += rejected.length;
      report.last_checkpoint += 1;
      report.region = region;
      report.region_offset = offset + page.length;
      await persistCheckpoint();
    }
    report.region_offset = 0;
  }
  report.status = report.failed_count ? "partial" : "completed";
  report.completed_at = new Date().toISOString();
  if (apply) {
    await upsertJob(
      process.env.SUPABASE_URL.trim(),
      process.env.SUPABASE_SERVICE_ROLE_KEY.trim(),
    );
  }
} catch (error) {
  report.status = "failed";
  report.failures += 1;
  report.error = error instanceof Error ? error.message : String(error);
  await persistCheckpoint();
  await fs.writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  throw error;
}

await persistCheckpoint();
await fs.writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
console.log(JSON.stringify(report, null, 2));

async function fetchAllParking(region) {
  const rows = [];
  for (let skip = 0; ; skip += 1000) {
    const url = new URL(`${API_BASE}/v1/Parking/OffStreet/CarPark/City/${region}`);
    url.searchParams.set("$format", "JSON");
    url.searchParams.set("$top", "1000");
    url.searchParams.set("$skip", String(skip));
    const payload = await tdxJson(url);
    const page = Array.isArray(payload)
      ? payload
      : payload?.CarParks || payload?.Items || payload?.ParkingLots || [];
    rows.push(...page);
    if (page.length < 1000) break;
  }
  return rows;
}

async function tdxJson(url) {
  if (!token) token = await accessToken();
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const response = await fetch(url, {
      headers: { Accept: "application/json", Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(20_000),
    });
    if (response.status === 401 && attempt === 0) {
      token = await accessToken();
      continue;
    }
    if (response.ok) return response.json();
    if (response.status !== 429 && response.status < 500) {
      throw new Error(`TDX fetch failed (${response.status})`);
    }
    await new Promise((resolve) => setTimeout(resolve, 500 * 2 ** attempt));
  }
  throw new Error("TDX fetch failed after retries");
}

async function accessToken() {
  const clientId = process.env.TDX_CLIENT_ID?.trim();
  const clientSecret = process.env.TDX_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) {
    throw new Error("TDX_CLIENT_ID and TDX_CLIENT_SECRET are required for live import; use --fixture for dry-run");
  }
  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      client_id: clientId,
      client_secret: clientSecret,
    }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) throw new Error(`TDX token failed (${response.status})`);
  const payload = await response.json();
  if (!payload.access_token) throw new Error("TDX token response is missing access_token");
  return payload.access_token;
}

async function stageBatch(rows) {
  const baseUrl = process.env.SUPABASE_URL?.trim();
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!baseUrl || !serviceKey) throw new Error("Supabase server credentials are required when TDX_SOUTH_APPLY=1");
  await upsertJob(baseUrl, serviceKey);
  const response = await fetch(`${baseUrl}/rest/v1/tdx_staging_records?on_conflict=source,dataset,region,source_id`, {
    method: "POST",
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      "Content-Type": "application/json",
      Prefer: "resolution=merge-duplicates,return=minimal",
    },
    body: JSON.stringify(rows.map((row) => ({ job_id: jobId, ...row }))),
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) throw new Error(`Supabase staging failed (${response.status})`);
  const rejected = rows.filter((row) => row.normalization_status === "rejected");
  if (rejected.length) {
    const failedResponse = await fetch(`${baseUrl}/rest/v1/tdx_failed_records`, {
      method: "POST",
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify(rejected.map((row) => ({
        job_id: jobId,
        source: row.source,
        dataset: row.dataset,
        region: row.region,
        source_id: row.source_id,
        error_code: row.validation_errors[0] || "validation_failed",
        error_message: row.validation_errors.join(","),
        raw_metadata: row.raw_metadata,
      }))),
      signal: AbortSignal.timeout(20_000),
    });
    if (!failedResponse.ok) {
      throw new Error(`Supabase reject log failed (${failedResponse.status})`);
    }
  }
}

async function upsertJob(baseUrl, serviceKey) {
  const response = await fetch(`${baseUrl}/rest/v1/tdx_import_jobs?on_conflict=job_id`, {
    method: "POST",
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      "Content-Type": "application/json",
      Prefer: "resolution=merge-duplicates,return=minimal",
    },
    body: JSON.stringify({
      job_id: jobId,
      source: report.source,
      source_version: sourceVersion,
      dataset,
      region: "South",
      batch_size: batchSize,
      processed_count: report.processed_count,
      success_count: report.success_count,
      failed_count: report.failed_count,
      last_checkpoint: report.last_checkpoint,
      started_at: report.started_at,
      updated_at: new Date().toISOString(),
      completed_at: report.completed_at,
      status: report.status,
      checkpoint: {
        region: report.region || null,
        region_offset: report.region_offset || 0,
      },
    }),
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) throw new Error(`Supabase job checkpoint failed (${response.status})`);
}

async function persistCheckpoint() {
  report.updated_at = new Date().toISOString();
  await fs.writeFile(checkpointPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
}

async function readJson(file, fallback) {
  try {
    return JSON.parse(await fs.readFile(file, "utf8"));
  } catch (error) {
    if (error?.code === "ENOENT") return fallback;
    throw error;
  }
}
