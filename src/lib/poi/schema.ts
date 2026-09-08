import {
  BRAND_ALIASES,
  keepTaggedChainBrand,
  nameFitsBrand,
  normalizePoiKey,
  resolveCanonicalBrand,
} from "@/lib/poi/aliases";
import {
  poiMainLayerFromCategory,
  poiSubcategoryFromCategory,
  type PoiMainLayerId,
} from "@/lib/poi/main-layers";

export const POI_CATEGORIES = [
  "convenience",
  "supermarket",
  "cafe",
  "restaurant",
  "fuel",
  "parking",
  "hospital",
  "clinic",
  "pharmacy",
  "school",
  "hotel",
  "government",
  "station",
  "mall",
  "park",
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
  mainCategory: PoiMainLayerId;
  subcategory: string;
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
  lastSeenAt?: string;
  sourceUpdatedAt?: string;
  phone?: string | null;
};

export type TaiwanPoiRow = {
  id: string;
  name: string;
  name_normalized: string;
  aliases: string[];
  category: PoiCategory;
  main_category?: string | null;
  subcategory?: string | null;
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
  phone?: string | null;
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
  const category = (row.category as PoiCategory) || "other";
  let brand = resolveCanonicalBrand(
    (row.brand as string | null) ?? null,
    name,
    category,
  );
  let keptAliases = aliases;
  if (brand && !keepTaggedChainBrand(name, brand, category)) {
    brand = null;
    keptAliases = [];
  }
  const brandMeta =
    BRAND_ALIASES.find((item) => item.brand === brand) ||
    BRAND_ALIASES.find(
      (item) =>
        nameFitsBrand(name, item.brand) ||
        (brand ? nameFitsBrand(brand, item.brand) : false),
    );
  if (brandMeta) {
    brand = brandMeta.brand;
    keptAliases = [
      ...new Set([
        ...keptAliases,
        ...brandMeta.keys.map(normalizePoiKey),
        ...brandMeta.names.map(normalizePoiKey),
      ]),
    ];
  }
  const subcategory =
    String(row.subcategory ?? row.sub_category ?? "").trim() ||
    poiSubcategoryFromCategory(category);
  const mainCategory = poiMainLayerFromCategory(category, subcategory);
  return {
    id: String(row.id ?? `${row.source ?? "osm"}-${row.sourceId ?? row.source_id ?? ""}`),
    name,
    nameNormalized,
    aliases: keptAliases,
    category,
    mainCategory,
    subcategory,
    brand,
    branchName: (row.branchName as string | null) ?? (row.branch_name as string | null) ?? null,
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
    lastSeenAt: String(row.lastSeenAt ?? row.last_seen_at ?? "") || undefined,
    sourceUpdatedAt: String(row.sourceUpdatedAt ?? row.source_updated_at ?? "") || undefined,
    phone:
      String(row.phone ?? row.tel ?? row.Telephone ?? "").trim() || null,
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
      subcategory: row.subcategory ?? undefined,
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
      phone: (row as { phone?: string | null }).phone ?? undefined,
    }) ?? {
      id: row.id,
      name: row.name,
      nameNormalized: row.name_normalized,
      aliases: row.aliases,
      category: row.category,
      mainCategory: poiMainLayerFromCategory(row.category, row.subcategory),
      subcategory: row.subcategory || poiSubcategoryFromCategory(row.category),
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
      confidence: row.confidence ?? 0.8,
      isActive: row.is_active !== false,
      phone: null,
    }
  );
}
