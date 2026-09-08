import type { PoiCategory } from "@/lib/poi/schema";

export const POI_CATEGORY_LABEL: Record<PoiCategory, string> = {
  convenience: "便利商店",
  supermarket: "超市",
  cafe: "咖啡店",
  restaurant: "餐廳",
  fuel: "加油站",
  parking: "停車場",
  hospital: "醫院",
  clinic: "診所",
  pharmacy: "藥局",
  school: "學校",
  hotel: "旅館",
  government: "政府機關",
  station: "車站",
  mall: "商場",
  park: "公園",
  landmark: "地標",
  other: "地點",
};

export function poiCategoryLabel(category?: string | null) {
  if (!category) return "地點";
  return POI_CATEGORY_LABEL[category as PoiCategory] ?? "地點";
}
