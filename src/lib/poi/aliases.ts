import type { PoiCategory } from "@/lib/poi/schema";

export const BRAND_ALIASES: { keys: string[]; names: string[]; brand: string; category: PoiCategory }[] = [
  { keys: ["7", "711", "7-11", "7-eleven", "7eleven", "小七", "七十一"], names: ["統一超商", "7-Eleven"], brand: "7-Eleven", category: "convenience" },
  { keys: ["全家", "familymart", "family mart"], names: ["全家便利商店", "FamilyMart"], brand: "FamilyMart", category: "convenience" },
  { keys: ["全聯", "pxmart", "px mart", "全聯福利中心"], names: ["全聯福利中心", "全聯"], brand: "PX Mart", category: "supermarket" },
  { keys: ["全國電子", "e-life", "elife"], names: ["全國電子"], brand: "E-Life", category: "other" },
  { keys: ["萊爾富", "hilife", "hi-life"], names: ["萊爾富"], brand: "Hi-Life", category: "convenience" },
  { keys: ["ok超商", "okmart", "ok mart"], names: ["OK超商"], brand: "OK Mart", category: "convenience" },
  {
    keys: ["蝦皮", "shopee", "蝦皮店到店"],
    names: ["蝦皮店到店", "Shopee"],
    brand: "蝦皮店到店",
    category: "convenience",
  },
  { keys: ["家樂福", "家樂", "carrefour"], names: ["家樂福"], brand: "Carrefour", category: "supermarket" },
  { keys: ["好市多", "costco"], names: ["好市多", "Costco"], brand: "Costco", category: "supermarket" },
  { keys: ["美廉社", "simplemart", "simple mart"], names: ["美廉社"], brand: "Simple Mart", category: "supermarket" },
  { keys: ["星巴克", "starbucks", "sbux"], names: ["星巴克", "Starbucks"], brand: "Starbucks", category: "cafe" },
  { keys: ["路易莎", "louisa"], names: ["路易莎咖啡"], brand: "Louisa", category: "cafe" },
  { keys: ["85度c", "85c", "85度"], names: ["85度C"], brand: "85C", category: "cafe" },
  { keys: ["麥當勞", "麥當", "mcdonalds", "mcdonald", "mcd"], names: ["麥當勞"], brand: "McDonald's", category: "restaurant" },
  { keys: ["肯德基", "kfc"], names: ["肯德基"], brand: "KFC", category: "restaurant" },
  { keys: ["摩斯", "mos"], names: ["摩斯漢堡"], brand: "MOS Burger", category: "restaurant" },
  { keys: ["中油", "cpc", "台灣中油", "中國石油", "中油加油站"], names: ["台灣中油", "中油", "中國石油"], brand: "CPC", category: "fuel" },
  { keys: ["台塑", "formosa", "台塑石油", "台塑石化", "台塑加油站"], names: ["台塑石油", "台塑石化", "台塑"], brand: "Formosa", category: "fuel" },
  { keys: ["台亞", "fpcc", "台亞石油", "台亞加油站"], names: ["台亞石油", "台亞"], brand: "台亞", category: "fuel" },
  { keys: ["全國加油站", "全國加油", "npc加油", "npc"], names: ["全國加油站", "全國"], brand: "全國", category: "fuel" },
  { keys: ["速邁樂", "smile", "統一速邁樂", "速邁樂加油站"], names: ["速邁樂", "Smile"], brand: "速邁樂", category: "fuel" },
  {
    keys: ["tesla", "特斯拉", "teslasupercharger", "supercharger"],
    names: ["Tesla Supercharger", "Tesla 超充", "特斯拉超充"],
    brand: "Tesla Supercharger",
    category: "fuel",
  },
  {
    keys: ["gogoro", "gostation", "go station", "gogoronetwork"],
    names: ["Gogoro", "Gogoro 換電站", "GoStation"],
    brand: "Gogoro",
    category: "fuel",
  },
];

export const CONVENIENCE_CHAIN_BRANDS = new Set([
  "7-Eleven",
  "FamilyMart",
  "Hi-Life",
  "OK Mart",
  "蝦皮店到店",
]);

export const FUEL_CHAIN_BRANDS = new Set([
  "CPC",
  "Formosa",
  "台亞",
  "全國",
  "速邁樂",
]);

export const BRAND_DISPLAY_LABEL: Record<string, string> = {
  "7-Eleven": "7-ELEVEN",
  FamilyMart: "全家",
  "Hi-Life": "萊爾富",
  "OK Mart": "OK超商",
  蝦皮店到店: "蝦皮店到店",
  "PX Mart": "全聯",
  CPC: "中油",
  Formosa: "台塑",
  台亞: "台亞",
  全國: "全國",
  速邁樂: "速邁樂",
  "Tesla Supercharger": "Tesla 超充",
  Gogoro: "Gogoro",
};

export function brandDisplayLabel(brand?: string | null) {
  if (!brand) return "";
  return BRAND_DISPLAY_LABEL[brand] ?? brand;
}

export const CATEGORY_ALIASES: { keys: string[]; category: PoiCategory; names: string[] }[] = [
  { keys: ["加油站", "加油", "gasstation", "fuel"], category: "fuel", names: ["加油站"] },
  { keys: ["停車場", "停車", "parking"], category: "parking", names: ["停車場"] },
  { keys: ["咖啡", "cafe", "coffee", "咖"], category: "cafe", names: ["咖啡"] },
  { keys: ["餐廳", "restaurant", "吃飯"], category: "restaurant", names: ["餐廳"] },
  { keys: ["醫院", "hospital"], category: "hospital", names: ["醫院"] },
  { keys: ["診所", "clinic"], category: "clinic", names: ["診所"] },
  { keys: ["藥局", "pharmacy", "藥房"], category: "pharmacy", names: ["藥局"] },
  { keys: ["便利商店", "超商", "convenience"], category: "convenience", names: ["便利商店"] },
  { keys: ["超市", "超市量販"], category: "supermarket", names: ["超市"] },
  { keys: ["學校", "school"], category: "school", names: ["學校"] },
  { keys: ["旅館", "飯店", "hotel"], category: "hotel", names: ["旅館"] },
  { keys: ["車站", "火車站"], category: "station", names: ["車站"] },
  { keys: ["公園", "park"], category: "park", names: ["公園"] },
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
  if (b.includes("teslasupercharger") || b.includes("supercharger") || b === "tesla" || b.includes("特斯拉")) {
    if (/體驗中心|旗艦店|餐酒館|展示中心|服務中心/.test(name)) return false;
    return (
      /supercharger|超級充電|超充/.test(n) ||
      (/tesla|特斯拉/.test(n) && /充電|charging|supercharger|超充/.test(n))
    );
  }
  if (b.includes("gogoro") || b.includes("gostation")) {
    return /gogoro|gostation|換電|電池交換|go站/.test(n);
  }
  if (b.includes("蝦皮") || b.includes("shopee")) {
    return /蝦皮|shopee|店到店/.test(n);
  }
  if (n.includes(b) || (n.length >= 2 && b.includes(n))) return true;
  if (b.includes("7eleven") || b === "711") {
    if (/攤位|號攤|郵筒|公車/.test(name)) return false;
    if (/巷/.test(name) && !/7eleven|統一超商|小七/.test(n)) return false;
    return /7eleven|統一超商|小七|^711$|^7eleven/.test(n) || n.startsWith("7eleven") || n.startsWith("統一超商");
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
  if (b.includes("carrefour") || b.includes("家樂福")) return n.includes("家樂福") || n.includes("carrefour");
  if (b.includes("costco") || b.includes("好市多")) return n.includes("好市多") || n.includes("costco");
  if (b.includes("simple") || b.includes("美廉社")) return n.includes("美廉社") || n.includes("simplemart");
  if (b === "85c" || b.includes("85度")) return n.includes("85") || n.includes("85度");
  if (b === "cpc" || b.includes("中油") || b.includes("中國石油")) {
    return n.includes("中油") || n.includes("cpc") || n.includes("中國石油") || n.includes("台灣中油");
  }
  if (b.includes("formosa") || b.includes("台塑")) {
    return n.includes("台塑") || n.includes("formosa");
  }
  if (b.includes("台亞") || b === "fpcc") {
    return n.includes("台亞") || n.includes("fpcc");
  }
  if (b === "全國" || b.includes("npc")) {
    return (n.includes("全國") && !n.includes("電子")) || n.includes("npc");
  }
  if (b.includes("速邁樂") || b.includes("smile")) {
    return n.includes("速邁樂") || n.includes("smile");
  }
  return false;
}

export function inferFuelChainBrand(name: string, brand?: string | null) {
  const hay = `${brand ?? ""} ${name}`.replaceAll("臺", "台");
  if (/台亞/.test(hay)) return "台亞";
  if (/台塑/.test(hay)) return "Formosa";
  if (/速邁樂|smile/i.test(hay)) return "速邁樂";
  if (/全國加油站|全國加油/.test(hay) || (/(?:^|[^\u4e00-\u9fff])全國(?:$|[^\u4e00-\u9fff電])/.test(hay) && /加油|npc/i.test(hay))) {
    return "全國";
  }
  if (/中油|中國石油|台灣中油|(?:^|[^a-z])cpc(?:$|[^a-z])/i.test(hay)) return "CPC";
  return null;
}

export function resolveCanonicalBrand(
  brand: string | null | undefined,
  name = "",
  category?: PoiCategory | null,
) {
  const tagged = (brand ?? "").trim();
  if (!category || category === "fuel") {
    const fuel = inferFuelChainBrand(name, tagged);
    if (fuel) return fuel;
  }
  if (tagged) {
    const exact = BRAND_ALIASES.find((item) => item.brand === tagged);
    if (exact && (!category || exact.category === category)) return exact.brand;
    const key = normalizePoiKey(tagged);
    const aliased = BRAND_ALIASES.find((item) => {
      if (category && item.category !== category) return false;
      if (normalizePoiKey(item.brand) === key) return true;
      if (item.names.some((label) => {
        const token = normalizePoiKey(label);
        return token.length >= 2 && (key === token || key.includes(token));
      })) return true;
      return item.keys.some((alias) => {
        const token = normalizePoiKey(alias);
        return token.length >= 2 && (key === token || key.includes(token));
      });
    });
    if (aliased) return aliased.brand;
  }
  if (name) {
    const named = BRAND_ALIASES.find((item) => {
      if (category && item.category !== category) return false;
      return nameFitsBrand(name, item.brand);
    });
    if (named) return named.brand;
  }
  return tagged || null;
}

/** Drop Photon/OSM brand tags that do not match the actual POI name. */
export function keepTaggedChainBrand(
  name: string,
  brand: string | null,
  category?: PoiCategory | null,
) {
  const resolved = resolveCanonicalBrand(brand, name, category);
  if (!resolved) return false;
  if (nameFitsBrand(name, resolved)) return true;
  if (/攤位|號攤|郵筒|公車/.test(name)) return false;
  const known = BRAND_ALIASES.find((item) => item.brand === resolved);
  if (!known) {
    return (
      (category === "fuel" || !category) &&
      /gogoro|tesla|特斯拉|supercharger/i.test(`${resolved} ${brand ?? ""} ${name}`)
    );
  }
  if (known.category === "convenience") {
    return category === "convenience" || CONVENIENCE_CHAIN_BRANDS.has(resolved);
  }
  if (known.category === "fuel") {
    return category === "fuel" || FUEL_CHAIN_BRANDS.has(resolved);
  }
  if (known.category === "hotel") {
    return category === "hotel";
  }
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
