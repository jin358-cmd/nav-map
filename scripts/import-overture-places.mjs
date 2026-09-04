#!/usr/bin/env node
/**
 * Server-side Overture Places / Buildings import.
 * GeoParquet must never be fetched in the browser.
 */
import { writeFileSync } from "node:fs";

const dryRun = !process.argv.includes("--apply");
const report = {
  dataset: "Overture Maps Places / Buildings",
  status: "DATASET NOT IMPORTED",
  dryRun,
  usage: ["POI", "building footprint", "landmark name"],
  notUsedFor: ["official exact house numbers"],
  total: 0,
  withCoordinates: 0,
  withoutCoordinates: 0,
  duplicates: 0,
  failed: 0,
  notes:
    "Download an official Overture release on a server, convert to WGS84, then upsert taiwan_address_index with accuracy=landmark.",
};

console.log(JSON.stringify(report, null, 2));
writeFileSync("address-import-overture-report.json", JSON.stringify(report, null, 2));
if (!dryRun) {
  console.error("DATASET NOT IMPORTED: OVERTURE_RELEASE_PATH is not configured.");
  process.exit(2);
}
