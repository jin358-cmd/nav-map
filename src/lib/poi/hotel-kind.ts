export const HOTEL_KINDS = [
  "all",
  "hostel",
  "business",
  "hotel",
  "motel",
] as const;

export type HotelKind = (typeof HOTEL_KINDS)[number];

const MOTEL_RE = /汽車旅館|汽車飯店|motel|摩鐵/i;

const HOSTEL_RE =
  /青年旅館|青年旅舍|青年之家|青旅|youth\s*hostel|\bhostels?\b|背包客棧|背包客|背包倉庫|膠囊旅店|膠囊旅館|backpacker/i;

const BUSINESS_RE =
  /商旅|商務旅館|商務飯店|商務酒店|商務旅店|business\s*(hotel|inn|lodge)|旅社|旅棧/i;

const HOTEL_RE =
  /飯店|大飯店|酒店|觀光旅館|國際觀光|\bhotels?\b|渡假村|度假村|度假會館|渡假會館|resort/i;

export type HotelFields = {
  name?: string | null;
  brand?: string | null;
  category?: string | null;
  subcategory?: string | null;
};

function haystack(poi: HotelFields) {
  return `${poi.name ?? ""} ${poi.brand ?? ""}`;
}

export function isHotelKind(
  value: string | null | undefined,
): value is HotelKind {
  return Boolean(value && HOTEL_KINDS.includes(value as HotelKind));
}

const NOT_LODGING_RE = /停車場|招呼站/;

export function classifyHotelKind(poi: HotelFields): HotelKind | null {
  const text = haystack(poi);
  if (NOT_LODGING_RE.test(text)) return null;
  if (MOTEL_RE.test(text)) return "motel";
  if (HOSTEL_RE.test(text) || poi.subcategory === "hostel") return "hostel";
  if (BUSINESS_RE.test(text)) return "business";
  if (HOTEL_RE.test(text)) return "hotel";
  if (poi.category === "hotel") return "all";
  return null;
}

export function matchesHotelKind(poi: HotelFields, kind: HotelKind) {
  if (NOT_LODGING_RE.test(haystack(poi))) return false;
  if (kind === "all") return poi.category === "hotel";
  return classifyHotelKind(poi) === kind;
}
