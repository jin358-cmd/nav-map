#!/usr/bin/env node
/**
 * Dry-run importer for nationwide official road names.
 * Does not download or invent datasets. Pass --apply only after a licensed file exists.
 */
import { writeFileSync } from "node:fs";

const dryRun = !process.argv.includes("--apply");
const report = {
  dataset: "內政部全國路名資料",
  status: "NOT CONFIGURED",
  dryRun,
  counties: "all",
  total: 0,
  withCoordinates: 0,
  withoutCoordinates: 0,
  duplicates: 0,
  failed: 0,
  notes:
    "Set ADDRESS_ROAD_NAMES_PATH to a licensed CSV/JSON extract. No official URL is hardcoded.",
};

console.log(JSON.stringify(report, null, 2));
writeFileSync("address-import-road-names-report.json", JSON.stringify(report, null, 2));
if (!dryRun) {
  console.error("DATASET NOT IMPORTED: licensed road-name file is not configured.");
  process.exit(2);
}
