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
}> = [
  { id: "food", label: "食" },
  { id: "clothing", label: "衣" },
  { id: "housing", label: "住" },
  { id: "transport", label: "行" },
  { id: "education", label: "育" },
  { id: "leisure", label: "樂" },
  { id: "medical", label: "醫療／生活" },
];

export type PoiLayerVisibility = Record<PoiMainLayerId, boolean>;

export const DEFAULT_POI_LAYER_VISIBILITY: PoiLayerVisibility = {
  food: true,
  clothing: true,
  housing: true,
  transport: true,
  education: true,
  leisure: true,
  medical: true,
};

const CATEGORY_TO_MAIN: Record<string, PoiMainLayerId> = {
  restaurant: "food",
  cafe: "food",
  convenience: "food",
  supermarket: "food",
  hotel: "housing",
  parking: "transport",
  fuel: "transport",
  station: "transport",
  school: "education",
  landmark: "leisure",
  mall: "leisure",
  park: "leisure",
  hospital: "medical",
  clinic: "medical",
  pharmacy: "medical",
  government: "medical",
  other: "leisure",
};

const SUBCATEGORY_TO_MAIN: Record<string, PoiMainLayerId> = {
  restaurant: "food",
  cafe: "food",
  breakfast: "food",
  "fast-food": "food",
  drink: "food",
  convenience: "food",
  supermarket: "food",
  "food-shop": "food",
  clothing: "clothing",
  shoes: "clothing",
  sportswear: "clothing",
  accessories: "clothing",
  hotel: "housing",
  hostel: "housing",
  homestay: "housing",
  furniture: "housing",
  home: "housing",
  "building-materials": "housing",
  parking: "transport",
  fuel: "transport",
  charging: "transport",
  railway: "transport",
  mrt: "transport",
  bus: "transport",
  "car-rental": "transport",
  "auto-repair": "transport",
  school: "education",
  tutoring: "education",
  library: "education",
  museum: "education",
  education: "education",
  attraction: "leisure",
  park: "leisure",
  cinema: "leisure",
  mall: "leisure",
  entertainment: "leisure",
  sports: "leisure",
  hospital: "medical",
  clinic: "medical",
  pharmacy: "medical",
  bank: "medical",
  atm: "medical",
  "post-office": "medical",
  police: "medical",
  "fire-station": "medical",
  government: "medical",
  "public-facility": "medical",
};

export function poiMainLayerFromCategory(
  category?: string | null,
  subcategory?: string | null,
): PoiMainLayerId {
  if (subcategory) {
    const mapped = SUBCATEGORY_TO_MAIN[subcategory.toLowerCase()];
    if (mapped) return mapped;
  }
  if (category && CATEGORY_TO_MAIN[category]) {
    return CATEGORY_TO_MAIN[category];
  }
  return "leisure";
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
