#!/usr/bin/env node
/**
 * Classify Batch 10 / historical NLSC misses. Does not retry NLSC.
 */
import { createReadStream, existsSync, writeFileSync } from "node:fs";
import { createInterface } from "node:readline";

const SOUTH = ["雲林縣", "嘉義市", "嘉義縣", "臺南市", "高雄市", "屏東縣"];

function classify(address, reason) {
  const text = String(address || "").trim();
  if (!text) return "missing_admin_unit";
  if (reason === "out_of_taiwan") return "invalid_coordinate";
  if (reason === "duplicate" || reason === "inactive") return "duplicate_or_inactive";
  if (/timeout|ECONN|ETIMEDOUT|fetch/i.test(String(reason || ""))) return "timeout_or_transport";
  if (!/[縣市]/.test(text)) return "missing_admin_unit";
  if (!/(?:路|街|大道|道|巷|弄)/.test(text) && /[村里].*鄰/.test(text)) {
    return "rural_address_without_road";
  }
  if (!/\d+號/.test(text) && !/\d+[-之]/.test(text)) return "parse_failed";
  if (reason === "no_coordinate") return "official_source_empty";
  if (reason === "low_nav_score") return "official_source_empty";
  return "unknown";
}

async function main() {
  const path = "src/data/gcis-import-rejects.jsonl";
  const counts = {};
  const south = {};
  let total = 0;
  let batchLike = 0;
  if (existsSync(path)) {
    const rl = createInterface({ input: createReadStream(path), crlfDelay: Infinity });
    for await (const line of rl) {
      if (!line.trim()) continue;
      let row;
      try {
        row = JSON.parse(line);
      } catch {
        continue;
      }
      const address = row.address || "";
      const reason = classify(address, row.reason);
      counts[reason] = (counts[reason] || 0) + 1;
      total += 1;
      if (SOUTH.some((name) => address.replaceAll("台", "臺").includes(name))) {
        south[reason] = (south[reason] || 0) + 1;
      }
      if (String(row.created_at || "").startsWith("2026-09-13") && row.reason === "no_coordinate") {
        batchLike += 1;
      }
    }
  }

  const report = {
    source: path,
    totalRejects: total,
    batch10NoCoordinateApprox: batchLike,
    expectedGeoFail: 2121,
    allReasons: counts,
    southReasons: south,
    retryPolicy: {
      willRetry: ["parse_failed", "rural_address_without_road", "timeout_or_transport"],
      willNotRetry: ["official_source_empty", "invalid_coordinate", "duplicate_or_inactive"],
      note: "未重打 NLSC。official_source_empty 不得無限重試。巷弄／道路中心只能進 review。",
    },
    missing:
      batchLike === 2121
        ? []
        : [
            "Batch 10 的 2,121 筆 NLSC 失敗明細未完整保存在 gcis-import-rejects.jsonl（2026-09-13 no_coordinate=0）。現有 rejects 多為歷史 low_nav／duplicate。未重打 NLSC。",
          ],
  };
  writeFileSync("docs/phase-5-3a-geo-fail-classify.json", `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify(report, null, 2));
}

main();
