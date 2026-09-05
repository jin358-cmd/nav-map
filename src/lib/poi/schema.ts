export const POI_CATEGORIES = [
  "convenience",
  "cafe",
  "restaurant",
  "fuel",
  "parking",
  "hospital",
  "pharmacy",
  "landmark",
  "other",
] as const;

export type PoiCategory = (typeof POI_CATEGORIES)[number];

export type PoiSource = "osm" | "overture" | "local";

export type TaiwanPoiRecord = {
  id: string;
  name: string;
  nameNormalized: string;
  aliases: string[];
  category: PoiCategory;
  brand: string | null;
  address: string;
  county: string | null;
  district: string | null;
  latitude: number;
  longitude: number;
  source: PoiSource;
  sourceId: string;
  updatedAt: string;
  license: string;
};

export type TaiwanPoiRow = {
  id: string;
  name: string;
  name_normalized: string;
  aliases: string[];
  category: PoiCategory;
  brand: string | null;
  address: string;
  county: string | null;
  district: string | null;
  latitude: number;
  longitude: number;
  source: PoiSource;
  source_id: string;
  updated_at: string;
  license: string;
};
