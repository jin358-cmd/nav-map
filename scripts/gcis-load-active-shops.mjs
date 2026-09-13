/**
 * Replay the GCIS unique-active shop list used by import-company-registry.mjs.
 * src/data/gcis-dataset-files.json already lists only storefront industry files.
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { cacheKey, cityFromAddress, halfWidth, looksLikeStorefront } from "./gcis-address.mjs";

const FILE_MAP = "src/data/gcis-dataset-files.json";
const CACHE_DIR = "/tmp/gcis-open-data";
const ACTIVE_STATUS = /核准設立|核准認許|核准登記/;
const DEAD_STATUS = /解散|廢止|歇業|撤銷|停業|遷他縣市/;

export function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;
  const src = text.replace(/^\uFEFF/, "");
  for (let i = 0; i < src.length; i += 1) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          cell += '"';
          i += 1;
        } else quoted = false;
      } else cell += ch;
      continue;
    }
    if (ch === '"') {
      quoted = true;
      continue;
    }
    if (ch === ",") {
      row.push(cell);
      cell = "";
      continue;
    }
    if (ch === "\n") {
      row.push(cell);
      if (row.some((item) => item.trim())) rows.push(row);
      row = [];
      cell = "";
      continue;
    }
    if (ch !== "\r") cell += ch;
  }
  if (cell || row.length) {
    row.push(cell);
    rows.push(row);
  }
  if (!rows.length) return [];
  const headers = rows[0].map((item) => item.trim());
  return rows.slice(1).map((values) => {
    const record = {};
    headers.forEach((key, index) => {
      record[key] = (values[index] ?? "").trim();
    });
    return record;
  });
}

export function loadActiveShops() {
  const fileMap = existsSync(FILE_MAP) ? JSON.parse(readFileSync(FILE_MAP, "utf8")) : {};
  const oids = new Set(Object.keys(fileMap));
  if (existsSync(CACHE_DIR)) {
    for (const name of readdirSync(CACHE_DIR)) {
      if (name.endsWith(".csv")) oids.add(name.replace(/\.csv$/, ""));
    }
  }
  const shops = [];
  let missingCsv = 0;
  for (const oid of oids) {
    const cacheFile = `${CACHE_DIR}/${oid}.csv`;
    if (!existsSync(cacheFile)) {
      missingCsv += 1;
      continue;
    }
    const rows = parseCsv(readFileSync(cacheFile, "utf8"));
    for (const row of rows) {
      const status = row["公司狀態"] || row["登記狀態"] || "";
      const name = row["公司名稱"] || row["商業名稱"] || "";
      const address = row["公司地址"] || row["商業地址"] || "";
      const taxId = row["統一編號"] || "";
      if (!taxId || !name || !address) continue;
      if (DEAD_STATUS.test(status) || !ACTIVE_STATUS.test(status)) continue;
      const kind = String(row["商業名稱"] || "").trim() ? "business" : "company";
      if (!looksLikeStorefront(kind, address)) continue;
      shops.push({
        taxId,
        name: halfWidth(name),
        address: halfWidth(address),
        kind,
        city: cityFromAddress(address),
        addrKey: cacheKey(address),
        oid,
      });
    }
  }
  const unique = new Map();
  for (const shop of shops) {
    if (!unique.has(shop.taxId)) unique.set(shop.taxId, shop);
  }
  const list = [...unique.values()].sort((a, b) => a.taxId.localeCompare(b.taxId));
  return { list, missingCsv, files: oids.size };
}
