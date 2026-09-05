import {
  matchedBrand,
  matchedCategory,
  matchedExactPlace,
  normalizePoiKey,
} from "@/lib/poi/aliases";

export function isDoorplateQuery(query: string) {
  return /[路街巷弄段號大道]/.test(query) && /\d/.test(query);
}

export type PoiQueryIntent = "exact" | "brand" | "category" | "address" | "mixed";

export function classifyPoiQuery(query: string): PoiQueryIntent {
  if (isDoorplateQuery(query)) return "address";
  if (matchedExactPlace(query)) return "exact";
  const brand = matchedBrand(query);
  const category = matchedCategory(query);
  const compact = normalizePoiKey(query);
  if (brand && compact.length - normalizePoiKey(brand.keys[0] ?? "").length >= 4) {
    return "mixed";
  }
  if (brand && !category) return "brand";
  if (category && !brand) return "category";
  if (brand && category) return "brand";
  if (/(車站|博物館|大學|夜市|碼頭|機場|醫院)/u.test(query) && compact.length >= 4) {
    return "exact";
  }
  return "mixed";
}

export function prefersNearby(intent: PoiQueryIntent) {
  return intent === "brand" || intent === "category";
}
