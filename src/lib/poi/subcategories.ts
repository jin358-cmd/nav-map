import type { PoiMainLayerId } from "@/lib/poi/main-layers";

export type PoiSubcategory = {
  id: string;
  label: string;
  aliases: string[];
};

export type PoiSubVisibility = Record<PoiMainLayerId, Record<string, boolean>>;

export const POI_SUBCATEGORIES: Record<PoiMainLayerId, PoiSubcategory[]> = {
  food: [
    { id: "restaurant", label: "餐廳", aliases: [] },
    { id: "cafe", label: "咖啡", aliases: [] },
    { id: "breakfast", label: "早餐", aliases: [] },
    { id: "fast-food", label: "速食", aliases: ["fast_food"] },
    { id: "drink", label: "飲料", aliases: [] },
    { id: "convenience", label: "超商", aliases: [] },
    { id: "supermarket", label: "超市", aliases: [] },
    { id: "food-shop", label: "食品店", aliases: ["food_shop"] },
    { id: "bakery", label: "烘焙", aliases: [] },
    { id: "bar", label: "酒吧", aliases: ["pub"] },
    { id: "ice-cream", label: "冰淇淋", aliases: ["ice_cream"] },
    { id: "tea", label: "茶飲", aliases: [] },
    { id: "other", label: "其他", aliases: [] },
  ],
  clothing: [
    { id: "clothing", label: "服飾", aliases: ["clothes"] },
    { id: "shoes", label: "鞋", aliases: [] },
    { id: "sportswear", label: "運動服", aliases: [] },
    { id: "accessories", label: "配件", aliases: [] },
    { id: "jewelry", label: "珠寶", aliases: ["jewellery"] },
    { id: "bag", label: "包袋", aliases: [] },
    { id: "boutique", label: "精品", aliases: [] },
    { id: "mall", label: "商場百貨", aliases: ["department-store", "department_store"] },
    { id: "other", label: "其他", aliases: [] },
  ],
  housing: [
    { id: "hotel", label: "飯店", aliases: [] },
    { id: "hostel", label: "旅社", aliases: [] },
    { id: "homestay", label: "民宿", aliases: ["guest-house", "guest_house"] },
    { id: "furniture", label: "家具", aliases: [] },
    { id: "home", label: "居家", aliases: ["houseware", "housewares"] },
    { id: "building-materials", label: "建材", aliases: ["building_materials"] },
    { id: "hardware", label: "五金 DIY", aliases: ["doityourself", "do-it-yourself"] },
    { id: "interior", label: "室內", aliases: [] },
    { id: "other", label: "其他", aliases: [] },
  ],
  transport: [
    { id: "parking", label: "停車場", aliases: [] },
    { id: "fuel", label: "加油站", aliases: [] },
    { id: "charging", label: "充電站", aliases: [] },
    { id: "station", label: "車站運輸", aliases: ["railway", "mrt", "bus"] },
    { id: "car-rental", label: "租車", aliases: ["car_rental"] },
    { id: "auto-repair", label: "保養維修", aliases: ["auto_repair"] },
    { id: "car", label: "汽車", aliases: [] },
    { id: "other", label: "其他", aliases: [] },
  ],
  education: [
    { id: "school", label: "學校", aliases: [] },
    { id: "college", label: "大專", aliases: ["university"] },
    { id: "kindergarten", label: "幼兒園", aliases: [] },
    { id: "tutoring", label: "補習", aliases: [] },
    { id: "library", label: "圖書館", aliases: [] },
    { id: "museum", label: "博物館", aliases: [] },
    { id: "bookstore", label: "書店", aliases: ["books"] },
    { id: "education", label: "教育", aliases: [] },
    { id: "other", label: "其他", aliases: [] },
  ],
  leisure: [
    { id: "attraction", label: "景點", aliases: [] },
    { id: "park", label: "公園", aliases: [] },
    { id: "cinema", label: "影城", aliases: [] },
    { id: "entertainment", label: "娛樂", aliases: [] },
    { id: "sports", label: "運動", aliases: [] },
    { id: "landmark", label: "地標", aliases: [] },
    { id: "karaoke", label: "卡拉OK", aliases: [] },
    { id: "nightclub", label: "夜店", aliases: [] },
    { id: "other", label: "其他", aliases: [] },
  ],
  medical: [
    { id: "hospital", label: "醫院", aliases: [] },
    { id: "clinic", label: "診所", aliases: ["dentist", "doctors"] },
    { id: "pharmacy", label: "藥局", aliases: [] },
    { id: "bank", label: "銀行", aliases: ["atm"] },
    { id: "post-office", label: "郵局", aliases: ["post_office"] },
    { id: "police", label: "警察", aliases: [] },
    { id: "fire-station", label: "消防", aliases: ["fire_station"] },
    { id: "government", label: "機關", aliases: ["public-facility", "public_facility"] },
    { id: "other", label: "其他", aliases: [] },
  ],
};

function normalizeTag(value?: string | null) {
  return (value || "").toLowerCase().replaceAll("_", "-").trim();
}

function matchSubId(layer: PoiMainLayerId, raw: string) {
  if (!raw) return null;
  for (const sub of POI_SUBCATEGORIES[layer]) {
    if (sub.id === raw || sub.aliases.includes(raw)) return sub.id;
  }
  return null;
}

export function resolvePoiSubcategoryId(
  layer: PoiMainLayerId,
  category?: string | null,
  subcategory?: string | null,
) {
  return (
    matchSubId(layer, normalizeTag(subcategory)) ??
    matchSubId(layer, normalizeTag(category)) ??
    "other"
  );
}

export function allPoiSubFlags(layer: PoiMainLayerId, on: boolean) {
  return Object.fromEntries(
    POI_SUBCATEGORIES[layer].map((sub) => [sub.id, on]),
  ) as Record<string, boolean>;
}

export function defaultPoiSubVisibility(): PoiSubVisibility {
  return Object.fromEntries(
    (Object.keys(POI_SUBCATEGORIES) as PoiMainLayerId[]).map((id) => [
      id,
      allPoiSubFlags(id, true),
    ]),
  ) as PoiSubVisibility;
}

export function poiSubSelectionCount(
  layer: PoiMainLayerId,
  subVisibility: PoiSubVisibility,
) {
  const subs = POI_SUBCATEGORIES[layer];
  const selected = subs.filter((sub) => subVisibility[layer]?.[sub.id]).length;
  return { selected, total: subs.length };
}

export function anyPoiSubOn(layer: PoiMainLayerId, subVisibility: PoiSubVisibility) {
  return Object.values(subVisibility[layer] ?? {}).some(Boolean);
}
