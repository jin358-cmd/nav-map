#!/usr/bin/env node
/**
 * Per-county doorplate importer. One county failure must not stop others.
 */
import { writeFileSync } from "node:fs";

const counties = [
  "臺北市",
  "新北市",
  "桃園市",
  "臺中市",
  "臺南市",
  "高雄市",
  "基隆市",
  "新竹市",
  "新竹縣",
  "苗栗縣",
  "彰化縣",
  "南投縣",
  "雲林縣",
  "嘉義市",
  "嘉義縣",
  "屏東縣",
  "宜蘭縣",
  "花蓮縣",
  "臺東縣",
  "澎湖縣",
  "金門縣",
  "連江縣",
];

const dryRun = !process.argv.includes("--apply");
const report = {
  dataset: "各縣市合法門牌公開資料",
  status: "NOT CONFIGURED",
  dryRun,
  counties: counties.map((county) => ({
    county,
    status: "NOT CONFIGURED",
    total: 0,
    withCoordinates: 0,
    withoutCoordinates: 0,
    duplicates: 0,
    failed: 0,
  })),
  notes:
    "Each county uses its own adapter and licensed file path. Missing files skip that county only.",
};

console.log(JSON.stringify(report, null, 2));
writeFileSync("address-import-doorplates-report.json", JSON.stringify(report, null, 2));
if (!dryRun) {
  console.error("DATASET NOT IMPORTED: no licensed county doorplate files configured.");
  process.exit(2);
}
