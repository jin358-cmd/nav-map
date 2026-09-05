import type { PoiCategory } from "@/lib/poi/schema";

export const BRAND_ALIASES: { keys: string[]; names: string[]; brand: string; category: PoiCategory }[] = [
  { keys: ["711", "7-11", "7-eleven", "7eleven", "小七", "七十一"], names: ["統一超商", "7-Eleven"], brand: "7-Eleven", category: "convenience" },
  { keys: ["全家", "familymart", "family mart"], names: ["全家便利商店", "FamilyMart"], brand: "FamilyMart", category: "convenience" },
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

export function matchedBrand(query: string) {
  const needle = normalizePoiKey(query);
  return BRAND_ALIASES.find((brand) => brand.keys.some((key) => tokenHit(needle, key))) ?? null;
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
  return Boolean(token) && (needle === token || needle.includes(token) || token.includes(needle));
}
