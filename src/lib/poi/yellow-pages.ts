import type { PoiMainLayerId } from "@/lib/poi/main-layers";

/**
 * 中華電信黃頁水平分類（食品餐飲、衣著配件、住屋居家、行車運輸、
 * 教育文化、休閒育樂、醫療保健）對應到生活圈圖層食衣住行育樂。
 * 來源：中華黃頁行業分類（26 大類之生活消費水平分類）。
 */
export const YELLOW_PAGES_LAYERS: Array<{
  id: PoiMainLayerId;
  label: string;
  yellowPages: string;
}> = [
  { id: "food", label: "食", yellowPages: "食品餐飲" },
  { id: "clothing", label: "衣", yellowPages: "衣著配件" },
  { id: "housing", label: "住", yellowPages: "住屋居家" },
  { id: "transport", label: "行", yellowPages: "行車運輸" },
  { id: "education", label: "育", yellowPages: "教育文化" },
  { id: "leisure", label: "樂", yellowPages: "休閒育樂" },
  { id: "medical", label: "醫", yellowPages: "醫療保健" },
];

const FOOD = new Set([
  "restaurant",
  "cafe",
  "breakfast",
  "fast-food",
  "drink",
  "convenience",
  "supermarket",
  "food-shop",
  "bakery",
  "bar",
  "ice-cream",
  "tea",
]);

const CLOTHING = new Set([
  "clothing",
  "clothes",
  "shoes",
  "sportswear",
  "accessories",
  "jewelry",
  "bag",
  "boutique",
  "mall",
  "department_store",
  "department-store",
]);

const HOUSING = new Set([
  "hotel",
  "hostel",
  "homestay",
  "furniture",
  "home",
  "houseware",
  "building-materials",
  "hardware",
  "doityourself",
  "interior",
]);

const TRANSPORT = new Set([
  "parking",
  "fuel",
  "charging",
  "railway",
  "mrt",
  "bus",
  "car-rental",
  "auto-repair",
  "station",
  "car",
]);

const EDUCATION = new Set([
  "school",
  "tutoring",
  "library",
  "museum",
  "education",
  "college",
  "kindergarten",
  "bookstore",
  "books",
]);

const LEISURE = new Set([
  "attraction",
  "park",
  "cinema",
  "entertainment",
  "sports",
  "landmark",
  "karaoke",
  "nightclub",
]);

const MEDICAL = new Set([
  "hospital",
  "clinic",
  "pharmacy",
  "bank",
  "atm",
  "post-office",
  "police",
  "fire-station",
  "government",
  "public-facility",
  "dentist",
  "doctors",
]);

export function yellowPagesLayerFromTags(
  category?: string | null,
  subcategory?: string | null,
): PoiMainLayerId {
  const keys = [subcategory, category]
    .map((value) => (value || "").toLowerCase().replaceAll("_", "-"))
    .filter(Boolean);
  for (const key of keys) {
    if (FOOD.has(key)) return "food";
    if (CLOTHING.has(key)) return "clothing";
    if (HOUSING.has(key)) return "housing";
    if (TRANSPORT.has(key)) return "transport";
    if (EDUCATION.has(key)) return "education";
    if (MEDICAL.has(key)) return "medical";
    if (LEISURE.has(key)) return "leisure";
  }
  return "leisure";
}
