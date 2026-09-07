import type { PoiCategory } from "@/lib/poi/schema";

export const BRAND_ALIASES: { keys: string[]; names: string[]; brand: string; category: PoiCategory }[] = [
  { keys: ["711", "7-11", "7-eleven", "7eleven", "小七", "七十一"], names: ["統一超商", "7-Eleven"], brand: "7-Eleven", category: "convenience" },
  { keys: ["全家", "familymart", "family mart"], names: ["全家便利商店", "FamilyMart"], brand: "FamilyMart", category: "convenience" },
  { keys: ["全聯", "pxmart", "px mart", "全聯福利中心"], names: ["全聯福利中心", "全聯"], brand: "PX Mart", category: "convenience" },
  { keys: ["全國電子", "e-life", "elife"], names: ["全國電子"], brand: "E-Life", category: "other" },
  { keys: ["萊爾富", "hilife", "hi-life"], names: ["萊爾富"], brand: "Hi-Life", category: "convenience" },
  { keys: ["ok超商", "okmart", "ok mart"], names: ["OK超商"], brand: "OK Mart", category: "convenience" },
  { keys: ["星巴克", "starbucks", "sbux"], names: ["星巴克", "Starbucks"], brand: "Starbucks", category: "cafe" },
  { keys: ["麥當勞", "麥當", "mcdonalds", "mcdonald", "mcd"], names: ["麥當勞"], brand: "McDonald's", category: "restaurant" },
  { keys: ["肯德基", "kfc"], names: ["肯德基"], brand: "KFC", category: "restaurant" },
  { keys: ["摩斯", "mos"], names: ["摩斯漢堡"], brand: "MOS Burger", category: "restaurant" },
  { keys: ["路易莎", "louisa"], names: ["路易莎咖啡"], brand: "Louisa", category: "cafe" },
];

export const CATEGORY_ALIASES: { keys: string[]; category: PoiCategory; names: string[] }[] = [
  { keys: ["加油站", "加油", "gasstation", "fuel"], category: "fuel", names: ["加油站"] },
  { keys: ["停車場", "停車", "parking"], category: "parking", names: ["停車場"] },
  { keys: ["咖啡", "cafe", "coffee"], category: "cafe", names: ["咖啡"] },
  { keys: ["餐廳", "restaurant", "吃飯"], category: "restaurant", names: ["餐廳"] },
  { keys: ["醫院", "hospital"], category: "hospital", names: ["醫院"] },
  { keys: ["藥局", "pharmacy", "藥房"], category: "pharmacy", names: ["藥局"] },
  { keys: ["便利商店", "超商", "convenience"], category: "convenience", names: ["便利商店"] },
];

export const EXACT_PLACE_ALIASES: { keys: string[]; names: string[] }[] = [
  { keys: ["台北車站", "台北火車站", "台北火車站", "taipeistation"], names: ["臺北車站"] },
  { keys: ["台南車站", "台南火車站", "台南火車站"], names: ["臺南車站"] },
  { keys: ["奇美博物館", "chimeimuseum"], names: ["奇美博物館"] },
  { keys: ["高雄車站", "高雄火車站"], names: ["高雄車站"] },
  { keys: ["花蓮車站", "花蓮火車站"], names: ["花蓮車站"] },
];

export function normalizePoiKey(value: string) {
  return value
    .toLowerCase()
    .replaceAll("臺", "台")
    .replace(/[（）()]/g, "")
    .replace(/[\s\-_.＋+]/g, "");
}

export function expandPoiQueries(query: string): string[] {
  const compact = query.trim();
  const needle = normalizePoiKey(compact);
  const names = new Set<string>([compact]);
  if (!needle) return [compact];

  for (const brand of BRAND_ALIASES) {
    if (brand.keys.some((key) => tokenHit(needle, key))) {
      for (const name of brand.names) names.add(name);
    }
  }
  for (const category of CATEGORY_ALIASES) {
    if (category.keys.some((key) => tokenHit(needle, key))) {
      for (const name of category.names) names.add(name);
    }
  }
  for (const place of EXACT_PLACE_ALIASES) {
    if (place.keys.some((key) => tokenHit(needle, key))) {
      for (const name of place.names) names.add(name);
    }
  }
  return [...names];
}

/** Drop Photon/OSM brand tags that do not match the actual POI name. */
export function nameFitsBrand(name: string, brand: string | null): boolean {
  if (!brand) return true;
  const n = normalizePoiKey(name);
  const b = normalizePoiKey(brand);
  if (!n || !b) return true;
  if (n.includes(b) || (n.length >= 2 && b.includes(n))) return true;
  if (b.includes("7eleven") || b === "711") {
    return /7eleven|統一超商|小七|^7-?11$|^711$/.test(n) || n.startsWith("7eleven") || n.startsWith("711");
  }
  if (b.includes("familymart") || b.includes("全家")) return n.includes("全家") || n.includes("familymart");
  if (b.includes("pxmart") || b.includes("全聯")) return n.includes("全聯") || n.includes("pxmart");
  if (b.includes("starbucks") || b.includes("星巴克")) return n.includes("星巴克") || n.includes("starbucks");
  if (b.includes("mcdonald") || b.includes("麥當勞")) return n.includes("麥當勞") || n.includes("mcdonald");
  if (b.includes("elife") || b.includes("全國電子")) return n.includes("全國電子") || n.includes("elife");
  if (b.includes("hilife") || b.includes("萊爾富")) return n.includes("萊爾富") || n.includes("hilife");
  if (b.includes("okmart") || b.includes("ok超商")) {
    return n.includes("ok超商") || (n.includes("ok") && (n.includes("超商") || n.includes("便利")));
  }
  if (b.includes("mos") || b.includes("摩斯")) return n.includes("摩斯") || n.includes("mos");
  if (b.includes("louisa") || b.includes("路易莎")) return n.includes("路易莎") || n.includes("louisa");
  return false;
}

export function matchedBrand(query: string) {
  const needle = normalizePoiKey(query);
  return BRAND_ALIASES.find((brand) => brand.keys.some((key) => tokenHit(needle, key))) ?? null;
}

export function brandsForPrefix(query: string) {
  const needle = normalizePoiKey(query);
  if (!needle) return [];
  return BRAND_ALIASES.filter(
    (brand) =>
      brand.keys.some((key) => normalizePoiKey(key).startsWith(needle)) ||
      brand.names.some((name) => normalizePoiKey(name).startsWith(needle)),
  );
}

export function matchedCategory(query: string) {
  const needle = normalizePoiKey(query);
  return CATEGORY_ALIASES.find((item) => item.keys.some((key) => tokenHit(needle, key))) ?? null;
}

export function matchedExactPlace(query: string) {
  const needle = normalizePoiKey(query);
  return EXACT_PLACE_ALIASES.find((item) => item.keys.some((key) => tokenHit(needle, key))) ?? null;
}

function tokenHit(needle: string, key: string) {
  const token = normalizePoiKey(key);
  if (!token) return false;
  if (needle === token) return true;
  const tokenNumeric = /^\d+$/.test(token);
  const needleNumeric = /^\d+$/.test(needle);
  if (tokenNumeric || needleNumeric) {
    if (tokenNumeric && needleNumeric) {
      return needle.startsWith(token) || token.startsWith(needle);
    }
    if (needleNumeric) return token.startsWith(needle);
    return false;
  }
  return (
    needle.startsWith(token) ||
    token.startsWith(needle) ||
    (token.length >= 2 && needle.includes(token)) ||
    (needle.length >= 2 && token.includes(needle))
  );
}
