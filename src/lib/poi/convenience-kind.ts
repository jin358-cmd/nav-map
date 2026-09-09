export const CONVENIENCE_KINDS = [
  "all",
  "seven",
  "familymart",
  "hilife",
  "okmart",
  "shopee",
] as const;

export type ConvenienceKind = (typeof CONVENIENCE_KINDS)[number];

const SHOPEE_RE = /蝦皮|shopee|店到店/i;
const SEVEN_RE = /7-?eleven|7eleven|統一超商|小七|7-11/i;
const FAMILY_RE = /全家|familymart|family\s*mart/i;
const HILIFE_RE = /萊爾富|hi-?life/i;
const OK_RE = /ok\s*mart|ok超商|ok便利|okmart/i;

const BRAND_TO_KIND: Record<string, Exclude<ConvenienceKind, "all">> = {
  "7-Eleven": "seven",
  FamilyMart: "familymart",
  "Hi-Life": "hilife",
  "OK Mart": "okmart",
  蝦皮店到店: "shopee",
};

export type ConvenienceStationFields = {
  name?: string | null;
  brand?: string | null;
  category?: string | null;
  subcategory?: string | null;
};

function haystack(poi: ConvenienceStationFields) {
  return `${poi.name ?? ""} ${poi.brand ?? ""} ${poi.subcategory ?? ""}`;
}

export function isConvenienceKind(
  value: string | null | undefined,
): value is ConvenienceKind {
  return Boolean(value && CONVENIENCE_KINDS.includes(value as ConvenienceKind));
}

export function classifyConvenienceKind(
  poi: ConvenienceStationFields,
): ConvenienceKind | null {
  const text = haystack(poi);
  if (SHOPEE_RE.test(text)) return "shopee";
  const branded = poi.brand ? BRAND_TO_KIND[poi.brand] : undefined;
  if (branded && branded !== "shopee") return branded;
  if (SEVEN_RE.test(text)) return "seven";
  if (FAMILY_RE.test(text)) return "familymart";
  if (HILIFE_RE.test(text)) return "hilife";
  if (OK_RE.test(text)) return "okmart";
  if (poi.category === "convenience") return "all";
  return null;
}

export function matchesConvenienceKind(
  poi: ConvenienceStationFields,
  kind: ConvenienceKind,
) {
  if (kind === "all") {
    return (
      poi.category === "convenience" || classifyConvenienceKind(poi) === "shopee"
    );
  }
  return classifyConvenienceKind(poi) === kind;
}
