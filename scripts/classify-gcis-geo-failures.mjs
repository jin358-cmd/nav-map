#!/usr/bin/env node
/**
 * Classify reconstructed NLSC misses. Prefers rebuilt Batch-10+ leftovers.
 */
import { existsSync, readFileSync } from "node:fs";

const REBUILT = "docs/phase-5-3a-geo-fail-classify.json";
const RETRY = "docs/phase-5-3a-nlsc-retry.json";

function main() {
  if (existsSync(REBUILT)) {
    const report = JSON.parse(readFileSync(REBUILT, "utf8"));
    if (existsSync(RETRY)) report.retry = { ...report.retry, ...JSON.parse(readFileSync(RETRY, "utf8")) };
    console.log(JSON.stringify(report, null, 2));
    return;
  }
  console.error("missing reconstructed report; run node scripts/reconstruct-nlsc-fails.mjs");
  process.exit(2);
}

main();
