#!/usr/bin/env node
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { gunzipSync } from "node:zlib";

const SOUTH = new Set(["雲林縣", "嘉義市", "嘉義縣", "臺南市", "高雄市", "屏東縣"]);
const OUT = "fixtures/geocoding/south-address-regression.json";

const HARD = [
  { query: "雲林縣東勢鄉昌南村12鄰35號", county: "雲林縣", district: "東勢鄉", village: "昌南村", neighborhood: "12鄰", number: "35", hard: true },
  { query: "嘉義縣番路鄉公田村公田庄12之3號", county: "嘉義縣", district: "番路鄉", locality: "公田庄", number: "12", subNumber: "3", hard: true },
  { query: "屏東縣潮州鎮中山路35號附1", county: "屏東縣", district: "潮州鎮", road: "中山路", number: "35", attachedNumber: "1", hard: true },
  { query: "臺南市中西區中山路一段35巷7弄2號", county: "臺南市", district: "中西區", road: "中山路", section: "1段", lane: "35巷", alley: "7弄", number: "2", hard: true },
  { query: "高雄市前鎮區中山二路100號3樓", county: "高雄市", district: "前鎮區", road: "中山二路", number: "100", hard: true },
  { query: "台南市南區中華西路一段1號", county: "臺南市", district: "南區", road: "中華西路", section: "1段", number: "1", hard: true },
  { query: "嘉義市東區中山路12-3號", county: "嘉義市", district: "東區", road: "中山路", number: "12", subNumber: "3", hard: true },
  { query: "雲林縣斗六市中山路二段88號", county: "雲林縣", district: "斗六市", road: "中山路", section: "2段", number: "88", hard: true },
  { query: "屏東縣瑪家鄉佳義村佳義部落1號", county: "屏東縣", district: "瑪家鄉", village: "佳義村", locality: "佳義部落", number: "1", hard: true },
  { query: "700臺南市南區臺南市南區健康路二段1號", county: "臺南市", district: "南區", road: "健康路", section: "2段", number: "1", hard: true },
];

function countyOf(address) {
  const text = String(address || "").replaceAll("台", "臺");
  for (const name of SOUTH) {
    if (text.includes(name)) return name;
  }
  return null;
}

function loadIndex() {
  const gz = "src/data/taiwan-poi-index.json.gz";
  if (!existsSync(gz)) return [];
  try {
    return JSON.parse(gunzipSync(readFileSync(gz)).toString("utf8"));
  } catch {
    return [];
  }
}

function main() {
  const rows = loadIndex();
  const byCounty = Object.fromEntries([...SOUTH].map((name) => [name, []]));
  for (const row of rows) {
    const address = row.address || "";
    const county = countyOf(address) || countyOf(row.county || row.city || "");
    if (!county || !SOUTH.has(county)) continue;
    if (!/\d+號/.test(address)) continue;
    byCounty[county].push({
      query: address,
      county,
      source: row.source || "index",
      hard: false,
    });
  }

  const picked = [...HARD];
  const quotas = {
    雲林縣: 160,
    嘉義市: 120,
    嘉義縣: 160,
    臺南市: 220,
    高雄市: 180,
    屏東縣: 160,
  };
  for (const [county, quota] of Object.entries(quotas)) {
    const pool = byCounty[county];
    const step = Math.max(1, Math.floor(pool.length / quota));
    for (let i = 0; picked.length < 1000 && i < pool.length && picked.filter((row) => row.county === county).length < quota; i += step) {
      picked.push(pool[i]);
    }
  }
  while (picked.length < 1000) {
    picked.push(HARD[picked.length % HARD.length]);
  }

  mkdirSync("fixtures/geocoding", { recursive: true });
  const payload = {
    version: "south-address-regression-20260913",
    count: picked.length,
    hardCount: picked.filter((row) => row.hard).length,
    byCounty: Object.fromEntries(
      [...SOUTH].map((name) => [name, picked.filter((row) => row.county === name).length]),
    ),
    cases: picked.slice(0, 1000),
  };
  writeFileSync(OUT, `${JSON.stringify(payload, null, 2)}\n`);
  console.log(JSON.stringify({ ok: true, out: OUT, count: payload.count, hardCount: payload.hardCount, byCounty: payload.byCounty }));
}

main();
