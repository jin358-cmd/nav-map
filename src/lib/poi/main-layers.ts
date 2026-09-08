import { yellowPagesLayerFromTags } from "@/lib/poi/yellow-pages";

export {
  YELLOW_PAGES_LAYERS,
  yellowPagesLayerFromTags,
} from "@/lib/poi/yellow-pages";

export const POI_MAIN_LAYER_IDS = [
  "food",
  "clothing",
  "housing",
  "transport",
  "education",
  "leisure",
  "medical",
] as const;

export type PoiMainLayerId = (typeof POI_MAIN_LAYER_IDS)[number];

export const POI_MAIN_LAYERS: Array<{
  id: PoiMainLayerId;
  label: string;
  short: string;
  yp: string;
}> = [
  { id: "food", label: "食 · 食品餐飲", short: "食", yp: "食品餐飲" },
  { id: "clothing", label: "衣 · 衣著配件", short: "衣", yp: "衣著配件" },
  { id: "housing", label: "住 · 住屋居家", short: "住", yp: "住屋居家" },
  { id: "transport", label: "行 · 行車運輸", short: "行", yp: "行車運輸" },
  { id: "education", label: "育 · 教育文化", short: "育", yp: "教育文化" },
  { id: "leisure", label: "樂 · 休閒育樂", short: "樂", yp: "休閒育樂" },
  { id: "medical", label: "醫 · 醫療保健", short: "醫", yp: "醫療保健" },
];

export type PoiLayerVisibility = Record<PoiMainLayerId, boolean>;

export const DEFAULT_POI_LAYER_VISIBILITY: PoiLayerVisibility = {
  food: false,
  clothing: false,
  housing: false,
  transport: false,
  education: false,
  leisure: false,
  medical: false,
};

export const POI_LAYER_COLORS: Record<PoiMainLayerId, string> = {
  food: "#f97316",
  clothing: "#fb7185",
  housing: "#f59e0b",
  transport: "#22d3ee",
  education: "#a78bfa",
  leisure: "#facc15",
  medical: "#ef4444",
};

export function defaultPoiLayerVisibility(): PoiLayerVisibility {
  return { ...DEFAULT_POI_LAYER_VISIBILITY };
}

export function activePoiLayerIds(visibility: PoiLayerVisibility): PoiMainLayerId[] {
  return POI_MAIN_LAYER_IDS.filter((id) => visibility[id]);
}

export function anyPoiLayerOn(visibility: PoiLayerVisibility) {
  return POI_MAIN_LAYER_IDS.some((id) => visibility[id]);
}

export function poiReadLabel(visibility: PoiLayerVisibility, focus?: PoiMainLayerId | null) {
  if (focus && visibility[focus]) {
    const focused = POI_MAIN_LAYERS.find((layer) => layer.id === focus);
    if (focused) return focused.yp;
  }
  const on = POI_MAIN_LAYERS.filter((layer) => visibility[layer.id]);
  if (on.length === 1) return on[0].yp;
  if (on.length > 1) return on.map((layer) => layer.yp).join("、");
  return "生活圖層";
}

/** 中華黃頁水平分類：食品餐飲／衣著配件／住屋居家／行車運輸／教育文化／休閒育樂／醫療保健。 */
export function poiMainLayerFromCategory(
  category?: string | null,
  subcategory?: string | null,
): PoiMainLayerId {
  return yellowPagesLayerFromTags(category, subcategory);
}

export function poiSubcategoryFromCategory(category?: string | null) {
  return (category || "other").toLowerCase();
}

export function isPoiLayerVisible(
  visibility: PoiLayerVisibility,
  category?: string | null,
  subcategory?: string | null,
) {
  return visibility[poiMainLayerFromCategory(category, subcategory)];
}
