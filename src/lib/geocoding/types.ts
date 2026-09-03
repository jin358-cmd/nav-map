export type GeocodeSource = "cache" | "tgos" | "nlsc" | "osm" | "google" | "local";

export type GeocodeMatchKind =
  | "exact-house"
  | "approximate"
  | "lane-center"
  | "road-center"
  | "landmark";

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

export type GeocodeProviderStatus = "ok" | "empty" | "disabled" | "error";

export type GeocodeResponse = {
  query: string;
  normalizedQuery: string;
  cacheHit: boolean;
  results: GeocodeResult[];
  providers: Partial<Record<GeocodeSource, GeocodeProviderStatus>>;
};
