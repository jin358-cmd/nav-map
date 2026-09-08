/** Shared 中華黃頁 horizontal classes for ingest scripts. Keep in sync with src/lib/poi/yellow-pages.ts */

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

export function yellowPagesLayerFromTags(category, subcategory) {
  const keys = [subcategory, category]
    .map((value) => String(value || "").toLowerCase().replaceAll("_", "-"))
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
