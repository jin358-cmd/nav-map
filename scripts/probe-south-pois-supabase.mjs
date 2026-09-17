#!/usr/bin/env node
/**
 * Read-only south-pilot / address-index cloud status.
 * Never writes. Never prints service-role keys.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { DATA_VERSION, SOUTH_PILOT_REGIONS, resolveSouthPoiIndex } from "./south-poi-shared.mjs";
import {
  applyBlockedReason,
  countTable,
  isProjectConfirmed,
  readSupabaseConfig,
} from "./supabase-navpilot.mjs";

const SUMMARY = "data/south-pilot/summary.json";
const CHECKPOINT = "data/south-pilot/import-checkpoint.json";
const ADDRESS_MANIFEST = "data/south-pilot/address-index-manifest.json";
const OUT_JSON = "docs/phase-5-3a-supabase-upload-status.json";
const OUT_MD = "docs/phase-5-3a-supabase-upload-status.md";

function loadJson(path, fallback = null) {
  if (!existsSync(path)) return fallback;
  return JSON.parse(readFileSync(path, "utf8"));
}

function localFiles() {
  const summary = loadJson(SUMMARY);
  const checkpoint = loadJson(CHECKPOINT);
  const addressManifest = loadJson(ADDRESS_MANIFEST);
  const resolved = resolveSouthPoiIndex(summary?.sourceSha256 || null);
  return {
    summary,
    checkpoint,
    addressManifest,
    sourceIndex: resolved.path,
    sourceIndexMatched: resolved.matched,
    sourceIndexSha256: resolved.sha256,
    localAddressIndex: existsSync("src/data/south-address-index.json.gz")
      ? "src/data/south-address-index.json.gz"
      : existsSync("data/south-pilot/address-index.json.gz")
        ? "data/south-pilot/address-index.json.gz"
        : null,
    migrations: [
      "supabase/migrations/20260916085144_20260904_taiwan_address_index.sql",
      "supabase/migrations/20260916085154_20260905_taiwan_poi_index.sql",
      "supabase/migrations/20260916085203_20260913_phase53a_address_index.sql",
      "supabase/migrations/20260916085212_20260913_phase53a_south_poi_cloud.sql",
      "supabase/migrations/20260916085221_20260916073635_phase53a_cloud_hardening.sql",
      "supabase/migrations/20260917234436_phase53a_advisor_remediation.sql",
    ].map((path) => ({ path, present: existsSync(path) })),
  };
}

function uploadPlan(summary) {
  const batchSize = Math.max(1000, Math.min(5000, Number(process.env.SOUTH_POI_BATCH || 1000)));
  const counties = SOUTH_PILOT_REGIONS.map((county, index) => {
    const row = summary?.byCounty?.[county] || {};
    const located = row.located || 0;
    const published = row.published || 0;
    return {
      step: index + 2,
      county,
      located,
      published,
      review: row.review || 0,
      batchesPublished: Math.ceil(published / batchSize),
      batchesLocated: Math.ceil(located / batchSize),
    };
  });
  return {
    batchSize,
    recommendedFirstCounty: "雲林縣",
    applyMigrationsStep: 1,
    counties,
    totals: summary?.actual || null,
  };
}

function markdown(report) {
  const cloud = report.cloud;
  const lines = [
    "# Phase 5.3A Supabase 上傳狀態",
    "",
    `檢查時間：${report.checkedAt}`,
    `資料版本：\`${report.dataVersion}\``,
    "",
    "## 結論",
    "",
    `**${report.verdict}** — ${report.headline}`,
    "",
    "## 本機檔案",
    "",
    `| 項目 | 狀態 |`,
    `| --- | --- |`,
    `| 來源索引 | ${report.local.sourceIndex ? `\`${report.local.sourceIndex}\`${report.local.sourceIndexMatched ? "（SHA 相符）" : "（SHA 未對上摘要）"}` : "缺失"} |`,
    `| 匯出摘要 | ${report.local.actual ? `candidates ${report.local.actual.candidates?.toLocaleString()}／published ${report.local.actual.published?.toLocaleString()}` : "缺失"} |`,
    `| import checkpoint | ${report.local.checkpoint ? `${report.local.checkpoint.status}／upserted ${report.local.checkpoint.upserted}` : "無"} |`,
    `| 南部門牌 staging | ${report.local.localAddressIndex || "缺失"} |`,
    "",
    "## 雲端",
    "",
    `| 項目 | 狀態 |`,
    `| --- | --- |`,
    `| SUPABASE_URL | ${report.supabase.configured ? "已設定（未印出）" : "未設定"} |`,
    `| SERVICE_ROLE | ${report.supabase.hasServiceRole ? "已設定（未印出）" : "未設定"} |`,
    `| 專案 ref 確認 | ${report.supabase.projectConfirmed ? "已對上 NAVPILOT_SUPABASE_PROJECT_REF" : "未確認"} |`,
    `| 阻擋原因 | ${report.supabase.blockedReason || "無"} |`,
    `| taiwan_poi_index 本版本 | ${cloud.poiVersionCount ?? "未連線"} |`,
    `| taiwan_poi_index published | ${cloud.poiPublishedCount ?? "未連線"} |`,
    `| taiwan_address_index | ${cloud.addressCount ?? "未連線"} |`,
    `| migrations 套用 | ${cloud.schemaReady == null ? "未連線" : cloud.schemaReady ? "表存在" : "表不存在或無權限"} |`,
    "",
    "## 門牌",
    "",
    "南部門牌目前是 NLSC 衍生 staging，**不是**各縣市合法門牌原始檔。未確認專案前不寫 `taiwan_address_index`。",
    "",
    "## 下一步（確認 NavPilot 專案後）",
    "",
    "1. NavPilot 遠端 5 份 schema migration 已套用；GitHub 檔名已對齊 `20260916085144`…`20260916085221`。",
    "2. Advisor 修正 `supabase/migrations/20260917234436_phase53a_advisor_remediation.sql` 需 Jin 確認後才 `supabase db push`（不得重跑舊 5 份）。",
    "3. 雲林 published dry-run：wouldUpsert=11515、wroteSupabase=false。未經確認不得 `SOUTH_POI_APPLY=1`。",
    "4. 確認寫入後才：`SOUTH_POI_APPLY=1 SOUTH_POI_COUNTIES=雲林縣 SOUTH_POI_PUBLISHED_ONLY=1 npm run import:south-pois`。",
    "5. 對帳通過後再其餘五縣市；門牌仍需官方檔或另一次明確確認。",
    "",
    "禁止寫入 GVG／租屋雷達專案。禁止自建未授權付費專案。禁止 `NEXT_PUBLIC_` 放 service role。",
    "",
  ];
  return `${lines.join("\n")}\n`;
}

async function probeCloud(config) {
  if (!config.ok) {
    return {
      reachable: false,
      schemaReady: null,
      poiVersionCount: null,
      poiPublishedCount: null,
      addressCount: null,
      error: config.reason,
    };
  }
  const versionFilter = `data_version=eq.${encodeURIComponent(DATA_VERSION)}`;
  const publishedFilter = `${versionFilter}&publish_status=eq.published&nav_ready=eq.true`;
  const [poi, published, address] = await Promise.all([
    countTable(config, "taiwan_poi_index", versionFilter),
    countTable(config, "taiwan_poi_index", publishedFilter),
    countTable(config, "taiwan_address_index", `data_version=eq.${encodeURIComponent(DATA_VERSION)}`).catch(
      async () => countTable(config, "taiwan_address_index"),
    ),
  ]);
  const schemaReady = poi.status !== 404 && poi.status !== 0;
  return {
    reachable: poi.status > 0,
    schemaReady,
    poiVersionCount: poi.count,
    poiPublishedCount: published.count,
    addressCount: address.count,
    poiStatus: poi.status,
    publishedStatus: published.status,
    addressStatus: address.status,
    error: poi.ok ? null : poi.text.slice(0, 180),
  };
}

async function main() {
  const local = localFiles();
  const config = readSupabaseConfig();
  const blocked = applyBlockedReason(config);
  const cloud = await probeCloud(config).catch((error) => ({
    reachable: false,
    schemaReady: null,
    poiVersionCount: null,
    poiPublishedCount: null,
    addressCount: null,
    error: error instanceof Error ? error.message : String(error),
  }));

  const uploaded = Number(cloud.poiVersionCount || 0) > 0;
  const localReady = Boolean(local.summary && local.sourceIndex && local.sourceIndexMatched !== false);
  let verdict = "NOT UPLOADED";
  let headline = "本機產物齊，雲端尚未寫入。";
  if (!localReady) {
    verdict = "LOCAL INCOMPLETE";
    headline = "缺少來源索引或 south-pilot 摘要，需先 export。";
  } else if (config.reason === "forbidden_project") {
    verdict = "BLOCKED";
    headline = "URL 疑似 GVG／租屋雷達，拒絕探測寫入路徑。";
  } else if (uploaded && Number(cloud.poiPublishedCount) === local.summary.actual.published) {
    verdict = "CLOUD MATCH";
    headline = "雲端 published 筆數與本機摘要相符。";
  } else if (uploaded) {
    verdict = "PARTIAL";
    headline = `雲端已有本版本 ${cloud.poiVersionCount} 筆，尚未對上 published ${local.summary.actual.published}。`;
  } else if (!config.ok) {
    verdict = "NOT UPLOADED";
    headline = "沒有 NavPilot Supabase 金鑰，雲端列數為 0（未連線）。";
  } else if (blocked === "project_ref_unconfirmed") {
    verdict = "NOT UPLOADED";
    headline = "金鑰在環境中，但尚未用 NAVPILOT_SUPABASE_PROJECT_REF 確認專案，沒有寫入。";
  }

  const report = {
    checkedAt: new Date().toISOString(),
    dataVersion: DATA_VERSION,
    verdict,
    headline,
    wroteSupabase: false,
    supabase: {
      configured: config.ok,
      hasServiceRole: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
      projectRefPresent: Boolean(process.env.NAVPILOT_SUPABASE_PROJECT_REF),
      projectConfirmed: isProjectConfirmed(config),
      blockedReason: blocked,
      hostKind: config.ok ? (config.url.includes("supabase.co") ? "supabase.co" : "custom") : null,
    },
    local: {
      sourceIndex: local.sourceIndex,
      sourceIndexMatched: local.sourceIndexMatched,
      sourceIndexSha256: local.sourceIndexSha256,
      actual: local.summary?.actual || null,
      byCountyPublished: Object.fromEntries(
        SOUTH_PILOT_REGIONS.map((county) => [county, local.summary?.byCounty?.[county]?.published || 0]),
      ),
      checkpoint: local.checkpoint,
      localAddressIndex: local.localAddressIndex,
      addressUnique: local.addressManifest?.uniqueAddresses ?? null,
      addressNotOfficial: Boolean(local.addressManifest?.notOfficialCountyFile),
      migrations: local.migrations,
    },
    cloud,
    plan: uploadPlan(local.summary),
    address: {
      officialCountyFiles: 0,
      nlscDerivedOnly: true,
      willNotUploadUntilOfficialOrExplicitConfirm: true,
    },
  };

  mkdirSync("docs", { recursive: true });
  writeFileSync(OUT_JSON, `${JSON.stringify(report, null, 2)}\n`);
  writeFileSync(OUT_MD, markdown(report));
  console.log(
    JSON.stringify(
      {
        verdict: report.verdict,
        headline: report.headline,
        dataVersion: report.dataVersion,
        localPublished: local.summary?.actual?.published ?? 0,
        checkpoint: local.checkpoint,
        supabaseConfigured: report.supabase.configured,
        blockedReason: report.supabase.blockedReason,
        cloud,
        next: report.supabase.configured
          ? "確認 NAVPILOT_SUPABASE_PROJECT_REF 後先上傳雲林 published"
          : "提供 NavPilot 專用 SUPABASE_URL + SERVICE_ROLE + 專案 ref",
        docs: [OUT_JSON, OUT_MD],
      },
      null,
      2,
    ),
  );
}

main();
