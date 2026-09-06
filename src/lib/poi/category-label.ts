import type { PoiCategory } from "@/lib/poi/schema";

export const POI_CATEGORY_LABEL: Record<PoiCategory, string> = {
  convenience: "便利商店",
  cafe: "咖啡店",
  restaurant: "餐廳",
  fuel: "加油／充電",
  parking: "停車場",
  hospital: "醫療",
  pharmacy: "藥局",
  landmark: "地標",
  other: "地點",
};

export function poiCategoryLabel(category?: string | null) {
  if (!category) return "地點";
  return POI_CATEGORY_LABEL[category as PoiCategory] ?? "地點";
}
