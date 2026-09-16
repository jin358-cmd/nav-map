import { createHash } from "node:crypto";
import { projectRefFromUrl } from "./supabase-navpilot.mjs";

export const SOUTH_ADDRESS_COUNTIES = [
  "雲林縣",
  "嘉義市",
  "嘉義縣",
  "臺南市",
  "高雄市",
  "屏東縣",
];
export const EXPECTED_NAVPILOT_REF = "rxzbsthsqlozxgctdoks";
export const EXPECTED_NAVPILOT_URL = "https://rxzbsthsqlozxgctdoks.supabase.co";

const CENTER_KINDS = new Set(["road-center", "lane-center"]);

export function addressIdFromKey(key) {
  return `nlsc-${createHash("sha256").update(String(key)).digest("hex").slice(0, 40)}`;
}

export function qualityScoreForAccuracy(accuracy) {
  if (accuracy === "exact-house") return 90;
  if (accuracy === "interpolated") return 60;
  if (accuracy === "lane-center") return 40;
  if (accuracy === "road-center") return 30;
  return 20;
}

export function stagingStatusForAccuracy(accuracy) {
  return CENTER_KINDS.has(accuracy) ? "staging" : "staging";
}

export function parseHouseToken(value) {
  const text = String(value || "");
  const match = text.match(/(\d+)(?:之(\d+))?/);
  return {
    houseNumber: match?.[1] ? `${match[1]}號` : text || null,
    subNumber: match?.[2] || null,
  };
}

export function toAddressIndexRow(row, meta) {
  const accuracy = CENTER_KINDS.has(row.a) ? row.a : row.a || "approximate";
  const house = parseHouseToken(row.h);
  return {
    id: addressIdFromKey(row.k),
    country_code: "TW",
    county: row.c,
    district: row.t || null,
    village: null,
    neighborhood: null,
    road: row.r || null,
    section: row.s || null,
    lane: null,
    alley: null,
    house_number: house.houseNumber,
    sub_number: house.subNumber,
    attached_number: null,
    locality: null,
    canonical_address_key: row.k,
    normalized_address: row.n,
    display_address: row.d,
    latitude: row.lat,
    longitude: row.lng,
    accuracy,
    source: "nlsc-derived",
    source_record_id: row.k,
    source_priority: 40,
    quality_score: qualityScoreForAccuracy(accuracy),
    region_validation: null,
    data_version: meta.version,
    publish_status: stagingStatusForAccuracy(accuracy),
    license: meta.license || "nlsc-derived-beta",
    coordinate_system: "EPSG:4326",
  };
}

export function cloudWriteGate({
  apply = process.env.ADDRESS_INDEX_APPLY === "1",
  allowNlsc = process.env.ADDRESS_INDEX_ALLOW_NLSC_DERIVED === "1",
  url = process.env.SUPABASE_URL || "",
  serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "",
  expectedRef = process.env.NAVPILOT_SUPABASE_PROJECT_REF || "",
  source = "nlsc-derived",
} = {}) {
  if (!apply) return { ok: false, reason: "dry_run" };
  if (!url || !serviceKey) return { ok: false, reason: "missing_credentials" };
  if (/gvg|rent|rental|租屋|qmptlkgseffmeqnarwnb/i.test(url)) return { ok: false, reason: "forbidden_project" };
  const wanted = String(expectedRef).trim().toLowerCase();
  if (!wanted) return { ok: false, reason: "project_ref_unconfirmed" };
  if (wanted !== EXPECTED_NAVPILOT_REF) return { ok: false, reason: "unexpected_project_ref" };
  const actualRef = projectRefFromUrl(url);
  if (actualRef !== EXPECTED_NAVPILOT_REF) return { ok: false, reason: "project_ref_unconfirmed" };
  if (source === "nlsc-derived" && !allowNlsc) {
    return { ok: false, reason: "nlsc_derived_blocked" };
  }
  return { ok: true, reason: null, projectRef: actualRef };
}

export function dedupeAddressRows(rows) {
  const seen = new Set();
  const out = [];
  for (const row of rows) {
    const key = row.canonical_address_key || row.id;
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(row);
  }
  return out;
}
