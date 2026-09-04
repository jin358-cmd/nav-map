export type GeocodeSource =
  | "cache"
  | "index"
  | "tgos"
  | "nlsc"
  | "osm"
  | "google"
  | "local"
  | "overture";

export type GeocodeMatchKind =
  | "exact-house"
  | "interpolated"
  | "approximate"
  | "lane-center"
  | "road-center"
  | "landmark";

export type AddressAccuracy = GeocodeMatchKind;

export type GeocodeResult = {
  id: string;
  label: string;
  formattedAddress: string;
  latitude: number;
  longitude: number;
  source: GeocodeSource;
  confidence: number;
  distanceMeters?: number;
  exactHouseNumber?: boolean;
  matchKind: GeocodeMatchKind;
};

export type GeocodeLookupMode = "suggest" | "search";

export type GeocodeSearchOptions = {
  latitude?: number;
  longitude?: number;
  signal?: AbortSignal;
  timeoutMs?: number;
};

export type GeocodeProvider = {
  name: GeocodeSource;
  enabled: boolean;
  search(
    query: string,
    options?: GeocodeSearchOptions,
  ): Promise<GeocodeResult[]>;
};

export type GeocodeProviderStatus =
  | "ok"
  | "empty"
  | "disabled"
  | "error"
  | "disabled_by_map_renderer_policy";

export type GeocodeResponse = {
  query: string;
  normalizedQuery: string;
  cacheHit: boolean;
  results: GeocodeResult[];
  providers: Partial<Record<GeocodeSource, GeocodeProviderStatus>>;
};
