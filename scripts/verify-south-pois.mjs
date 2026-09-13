#!/usr/bin/env node
import { existsSync, readFileSync } from "node:fs";
import { SOUTH_PILOT_SET } from "./south-poi-shared.mjs";

const SUMMARY = "data/south-pilot/summary.json";

function main() {
  if (!existsSync(SUMMARY)) {
    console.error("missing data/south-pilot/summary.json — run export first");
    process.exit(2);
  }
  const summary = JSON.parse(readFileSync(SUMMARY, "utf8"));
  const errors = [];
  if (summary.duplicateSourceId > 0) errors.push("duplicate source+id");
  for (const [county, row] of Object.entries(summary.byCounty || {})) {
    if (!SOUTH_PILOT_SET.has(county)) errors.push(`non-south county ${county}`);
    if ((row.published || 0) && !SOUTH_PILOT_SET.has(county)) {
      errors.push(`published outside south: ${county}`);
    }
  }
  if (summary.sourceCount < 200_000) errors.push("source index too small");
  if (summary.checkpoint !== "completed") errors.push("checkpoint not completed");

  const result = {
    ok: errors.length === 0,
    errors,
    dataVersion: summary.dataVersion,
    actual: summary.actual,
    diffs: summary.diffs,
  };
  console.log(JSON.stringify(result, null, 2));
  if (errors.length) process.exit(1);
}

main();
