import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import process from "node:process";

const stateDir = await fs.mkdtemp(path.join(os.tmpdir(), "navpilot-tdx-resume-"));
const fixturePath = path.join(stateDir, "fixture.json");
const checkpointPath = path.join(stateDir, "checkpoint.json");
const reportPath = path.join(stateDir, "last-report.json");
const stagingPath = path.join(stateDir, "staging.json");

const rows = Array.from({ length: 8 }, (_, index) => ({
  CarParkID: `resume-${index + 1}`,
  CarParkName: { Zh_tw: `Resume Test ${index + 1}` },
  Address: `Tainan test ${index + 1}`,
  CarParkPosition:
    index === 7
      ? { PositionLat: 35, PositionLon: 140 }
      : { PositionLat: 22.99 + index * 0.001, PositionLon: 120.2 + index * 0.001 },
  TotalSpaces: 20 + index,
  UpdateTime: "2026-09-26T00:00:00+08:00",
}));
await fs.writeFile(
  fixturePath,
  `${JSON.stringify({
    YunlinCounty: [],
    ChiayiCounty: [],
    Chiayi: [],
    Tainan: rows,
    Kaohsiung: [],
    PingtungCounty: [],
  })}\n`,
  "utf8",
);

const first = startImporter(true);
const firstExit = onceExit(first);
await waitForCheckpoint(checkpointPath, (value) => value.last_checkpoint >= 1);
const interrupted = JSON.parse(await fs.readFile(checkpointPath, "utf8"));
assert.equal(interrupted.status, "running");
assert.equal(interrupted.processed_count, 2);
first.kill("SIGTERM");
await firstExit;

const second = startImporter(false);
const secondExit = await onceExit(second);
assert.equal(secondExit.code, 0, secondExit.stderr || secondExit.stdout);

const report = JSON.parse(await fs.readFile(reportPath, "utf8"));
const staging = JSON.parse(await fs.readFile(stagingPath, "utf8"));
const uniqueKeys = new Set(
  staging.map((row) => `${row.source}:${row.dataset}:${row.region}:${row.source_id}`),
);
const accepted = staging.filter((row) => row.normalization_status === "accepted").length;
const rejected = staging.filter((row) => row.normalization_status === "rejected").length;

assert.equal(report.job_id, interrupted.job_id);
assert.equal(report.fetched, 8);
assert.equal(report.processed_count, 8);
assert.equal(report.success_count, 7);
assert.equal(report.failed_count, 1);
assert.equal(report.accepted, accepted);
assert.equal(report.rejected, rejected);
assert.equal(report.duplicates, 0);
assert.equal(report.failures, 0);
assert.equal(report.last_checkpoint, 4);
assert.equal(staging.length, 8);
assert.equal(uniqueKeys.size, 8);

console.log(JSON.stringify({
  ok: true,
  interrupted_after_checkpoint: interrupted.last_checkpoint,
  resumed_job_id: report.job_id,
  fetched: report.fetched,
  processed: report.processed_count,
  accepted,
  rejected,
  duplicates: report.duplicates,
  failures: report.failures,
  checkpoints: report.last_checkpoint,
  staging: staging.length,
  unique_staging: uniqueKeys.size,
}, null, 2));

function startImporter(delayed) {
  const args = [
    "scripts/import-tdx-south.mjs",
    "--dry-run",
    `--fixture=${fixturePath}`,
    `--state-dir=${stateDir}`,
  ];
  if (delayed) args.push("--test-delay-ms=2000");
  return spawn(process.execPath, args, {
    cwd: process.cwd(),
    env: { ...process.env, TDX_BATCH_SIZE: "2" },
    stdio: ["ignore", "pipe", "pipe"],
  });
}

async function waitForCheckpoint(file, predicate) {
  const deadline = Date.now() + 15_000;
  while (Date.now() < deadline) {
    try {
      const value = JSON.parse(await fs.readFile(file, "utf8"));
      if (predicate(value)) return value;
    } catch (error) {
      if (error?.code !== "ENOENT" && !(error instanceof SyntaxError)) throw error;
    }
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error("Timed out waiting for importer checkpoint");
}

function onceExit(child) {
  return new Promise((resolve, reject) => {
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.once("error", reject);
    child.once("exit", (code, signal) => resolve({ code, signal, stdout, stderr }));
  });
}
