export type AddressAccuracy =
  | "exact-house"
  | "interpolated"
  | "approximate"
  | "lane-center"
  | "road-center"
  | "landmark";

export type AddressCoordinateSystem = "EPSG:4326" | "TWD97" | "unknown";

export type AddressSourceStatus =
  | "enabled"
  | "not_configured"
  | "dataset_not_imported"
  | "disabled";

export type AddressDataRecord = {
  id: string;
  countryCode: "TW";
  county: string | null;
  district: string | null;
  village: string | null;
  neighborhood: string | null;
  road: string | null;
  section: string | null;
  lane: string | null;
  alley: string | null;
  houseNumber: string | null;
  normalizedAddress: string;
  displayAddress: string;
  latitude: number | null;
  longitude: number | null;
  accuracy: AddressAccuracy;
  source: string;
  sourceRecordId?: string;
  sourceUpdatedAt?: string;
  importedAt: string;
  license?: string;
  coordinateSystem: AddressCoordinateSystem;
};

export type AddressSourceManifest = {
  county: string;
  datasetName: string;
  sourceUrl: string;
  license: string;
  coordinateSystem: AddressCoordinateSystem;
  lastCheckedAt: string;
  enabled: boolean;
  status: AddressSourceStatus;
  notes: string;
};

export type AddressImportStats = {
  county: string;
  datasetName: string;
  source: string;
  license: string;
  total: number;
  withCoordinates: number;
  withoutCoordinates: number;
  duplicates: number;
  failed: number;
  updatedAt: string;
};

export const TAIWAN_COUNTIES = [
  "臺北市",
  "新北市",
  "桃園市",
  "臺中市",
  "臺南市",
  "高雄市",
  "基隆市",
  "新竹市",
  "新竹縣",
  "苗栗縣",
  "彰化縣",
  "南投縣",
  "雲林縣",
  "嘉義市",
  "嘉義縣",
  "屏東縣",
  "宜蘭縣",
  "花蓮縣",
  "臺東縣",
  "澎湖縣",
  "金門縣",
  "連江縣",
] as const;
