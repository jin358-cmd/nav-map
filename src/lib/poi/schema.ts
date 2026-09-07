import { nameFitsBrand } from "@/lib/poi/aliases";

export const POI_CATEGORIES = [
  "convenience",
  "cafe",
  "restaurant",
  "fuel",
  "parking",
  "hospital",
  "pharmacy",
  "landmark",
  "other",
] as const;

export type PoiCategory = (typeof POI_CATEGORIES)[number];

export type PoiSource = "osm" | "overture" | "local" | "nlsc" | "gov";

export type TaiwanPoiRecord = {
  id: string;
  name: string;
  nameNormalized: string;
  aliases: string[];
  category: PoiCategory;
  brand: string | null;
  branchName: string | null;
  address: string;
  addressNormalized: string;
  city: string | null;
  county: string | null;
  district: string | null;
  latitude: number;
  longitude: number;
  source: PoiSource;
  sourceId: string;
  updatedAt: string;
  license: string;
  confidence: number;
  isActive: boolean;
};

export type TaiwanPoiRow = {
  id: string;
  name: string;
  name_normalized: string;
  aliases: string[];
  category: PoiCategory;
  brand: string | null;
  branch_name: string | null;
  address: string;
  address_normalized: string;
  city: string | null;
  county: string | null;
  district: string | null;
  latitude: number;
  longitude: number;
  source: PoiSource;
  source_id: string;
  updated_at: string;
  license: string;
  confidence: number | null;
  is_active: boolean | null;
};

function compactKey(value: string) {
  return value
    .toLowerCase()
    .replaceAll("臺", "台")
    .replace(/[（）()]/g, "")
    .replace(/[\s\-_.＋+]/g, "");
}

export function hydratePoiRecord(row: Partial<TaiwanPoiRecord> & Record<string, unknown>): TaiwanPoiRecord | null {
  const latitude = Number(row.latitude);
  const longitude = Number(row.longitude);
  const name = String(row.name ?? "").trim();
  if (!name || !Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  const county =
    (typeof row.county === "string" && row.county) ||
    (typeof row.city === "string" && row.city) ||
    null;
  const address = String(row.address ?? "");
  const nameNormalized = String(row.nameNormalized ?? compactKey(name));
  const aliases = Array.isArray(row.aliases)
    ? [...new Set(row.aliases.map((item) => compactKey(String(item))).filter(Boolean))]
    : [];
  let brand = (row.brand as string | null) ?? null;
  let keptAliases = aliases;
  if (brand && !nameFitsBrand(name, brand)) {
    brand = null;
    keptAliases = [];
  }
  return {
    id: String(row.id ?? `${row.source ?? "osm"}-${row.sourceId ?? row.source_id ?? ""}`),
    name,
    nameNormalized,
    aliases: keptAliases,
    category: (row.category as PoiCategory) || "other",
    brand,
    branchName: (row.branchName as string | null) ?? null,
    address,
    addressNormalized: String(row.addressNormalized ?? compactKey(address)),
    city: (row.city as string | null) ?? county,
    county,
    district: (row.district as string | null) ?? null,
    latitude,
    longitude,
    source: (row.source as PoiSource) || "osm",
    sourceId: String(row.sourceId ?? row.source_id ?? row.id ?? ""),
    updatedAt: String(row.updatedAt ?? row.updated_at ?? new Date().toISOString()),
    license: String(row.license ?? "ODbL"),
    confidence: Number.isFinite(Number(row.confidence)) ? Number(row.confidence) : 0.8,
    isActive: row.isActive !== false && row.is_active !== false,
  };
}

export function rowToRecord(row: TaiwanPoiRow): TaiwanPoiRecord {
  return (
    hydratePoiRecord({
      id: row.id,
      name: row.name,
      nameNormalized: row.name_normalized,
      aliases: row.aliases,
      category: row.category,
      brand: row.brand,
      branchName: row.branch_name,
      address: row.address,
      addressNormalized: row.address_normalized,
      city: row.city,
      county: row.county,
      district: row.district,
      latitude: row.latitude,
      longitude: row.longitude,
      source: row.source,
      sourceId: row.source_id,
      updatedAt: row.updated_at,
      license: row.license,
    confidence: row.confidence ?? undefined,
      isActive: row.is_active ?? undefined,
    }) ?? {
      id: row.id,
      name: row.name,
      nameNormalized: row.name_normalized,
      aliases: row.aliases ?? [],
      category: row.category,
      brand: row.brand,
      branchName: row.branch_name,
      address: row.address,
      addressNormalized: row.address_normalized || compactKey(row.address),
      city: row.city ?? row.county,
      county: row.county,
      district: row.district,
      latitude: row.latitude,
      longitude: row.longitude,
      source: row.source,
      sourceId: row.source_id,
      updatedAt: row.updated_at,
      license: row.license,
      confidence: row.confidence ?? 0.8,
      isActive: row.is_active !== false,
    }
  );
}
