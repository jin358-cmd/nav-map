export type LngLat = {
  lng: number;
  lat: number;
};

export type VehiclePose = LngLat & {
  heading: number;
  accuracy?: number;
  speedMps?: number;
  source: "demo" | "gps";
};

/** 畫面上黃色箭頭用的位置；不得回寫 GPS。 */
export type DisplayPose = LngLat & {
  heading: number;
  routeMeters: number;
  snapConfidence: number;
  snapped: boolean;
};

export type GpsStatus =
  | "idle"
  | "locating"
  | "active"
  | "denied"
  | "unavailable";

export type CameraMode = "2d" | "3d";
export type FollowOrientation = "heading-up" | "north-up";
export type MapDisplayMode = "light" | "dark" | "auto" | "satellite";
export type SavedPlaceType = "home" | "work" | "custom";

export type SavedPlace = {
  id: string;
  type: SavedPlaceType;
  displayName: string;
  originalAddress?: string;
  latitude: number;
  longitude: number;
  createdAt: string;
  updatedAt: string;
};

export type CctvStatus = "online" | "offline" | "unknown" | "unsupported";
export type CctvSourceType = "city" | "freeway";
export type CctvDataOrigin = "tdx-live" | "snapshot" | "mock" | "unavailable";

export type CctvCamera = {
  id: string;
  name: string;
  intersection: string;
  roadName: string;
  crossRoad: string;
  direction: string;
  directionLabel: string;
  district: string;
  city: string;
  sourceType: CctvSourceType;
  dataOrigin: CctvDataOrigin;
  status: CctvStatus;
  location: LngLat;
  url: string;
  distanceKm?: number;
  withinLocateRadius?: boolean;
  withinNearby?: boolean;
  ahead?: boolean;
  alongRoute?: boolean;
  updatedAt: string;
  snapshotLabel: string;
};

export type MapViewport = {
  center: LngLat;
  zoom: number;
  bounds: {
    west: number;
    south: number;
    east: number;
    north: number;
  };
};

export type TrafficLevel =
  | "smooth"
  | "slow"
  | "congested"
  | "severe"
  | "blocked";
export type TrafficSourceType = "city" | "freeway";
export type TrafficDataOrigin = "tdx-live" | "mock" | "unavailable";
export type TrafficPublishSource = "tdx" | "mock" | "unavailable";

export type TrafficSegment = {
  id: string;
  name: string;
  roadName: string;
  direction: string;
  level: TrafficLevel;
  congestionLevel: TrafficLevel;
  coordinates: [number, number][];
  sourceType: TrafficSourceType;
  dataOrigin: TrafficDataOrigin;
  source: TrafficPublishSource;
  speedKmh?: number;
  averageSpeed?: number;
  travelTimeSec?: number;
  congestionLabel?: string;
  updatedAt?: string;
};

export type TrafficCatalog = {
  origin: TrafficDataOrigin;
  segments: TrafficSegment[];
  fetchedAt: string;
};

export type SpeedEnforcementPoint = {
  id: string;
  city: string;
  district: string;
  address: string;
  department: string;
  branch: string;
  direction: string;
  speedLimit?: number;
  note?: string;
  location: LngLat;
  dataOrigin: "tgos" | "open-data";
};

export type SpeedEnforcementCatalog = {
  origin: "tgos" | "open-data";
  points: SpeedEnforcementPoint[];
  fetchedAt: string;
};

export type DisasterKind =
  | "flood"
  | "closure"
  | "quake"
  | "typhoon"
  | "heavy-rain"
  | "strong-wind"
  | "landslide"
  | "other";
export type DisasterDataOrigin = "ncdr-live" | "mock" | "unavailable";
export type DisasterPublishSource = "ncdr" | "mock" | "unavailable";
export type DisasterSeverity = "watch" | "warning" | "emergency";

export type DisasterAlert = {
  id: string;
  kind: DisasterKind;
  title: string;
  description: string;
  location: LngLat;
  severity: DisasterSeverity;
  dataOrigin: DisasterDataOrigin;
  source: string;
  category?: string;
  area?: string;
  areaDesc?: string;
  sourceUrl?: string;
  effectiveAt?: string;
  issuedAt?: string;
  expiresAt?: string;
  updatedAt?: string;
};

export type DisasterCatalog = {
  origin: DisasterDataOrigin;
  alerts: DisasterAlert[];
  fetchedAt: string;
};

export type DataFreshness = "live" | "stale" | "unavailable";

export type AccidentReport = {
  id: string;
  title: string;
  description: string;
  location: LngLat;
  roadName?: string;
  direction?: string;
  issuedAt?: string;
  updatedAt?: string;
  severity?: string;
  source?: string;
  freshness?: DataFreshness;
};

export type ConstructionEvent = {
  id: string;
  title: string;
  description: string;
  location: LngLat;
  roadName?: string;
  direction?: string;
  issuedAt?: string;
  updatedAt?: string;
  severity?: string;
  source?: string;
  freshness?: DataFreshness;
};

export type EventDataOrigin = "tdx-live" | "mock" | "unavailable";

export type EventCatalog<T> = {
  origin: EventDataOrigin;
  items: T[];
  fetchedAt: string;
};

export type RoadIntelKind =
  | "cctv"
  | "construction"
  | "congestion"
  | "accident"
  | "disaster";

export type LayerKindVisibility = Record<RoadIntelKind, boolean>;

export type MapFocusTarget = {
  lng: number;
  lat: number;
  key: number;
};

export type SelectedMapEvent = {
  kind: RoadIntelKind;
  id: string;
};

export type RoadIntelItem = {
  id: string;
  kind: RoadIntelKind;
  title: string;
  detail: string;
  distanceMeters: number;
  cameraId?: string;
  eventId?: string;
  location?: LngLat;
  freshness?: DataFreshness;
};

export type NavigationManeuver = {
  distanceMeters: number;
  action: string;
  roadName: string;
  hint: string;
  remainingKm: number;
  etaMinutes: number;
};

export type RouteStep = {
  id: string;
  action: string;
  roadName: string;
  /** 此分段本身要行駛的距離 */
  distanceMeters: number;
  /** 到達此路口／轉向前回轉的距離 */
  cueMeters: number;
  cumulativeMeters: number;
  type: string;
  modifier?: string;
  location?: LngLat;
};

export type GeocodeMatchKind =
  | "exact-house"
  | "interpolated"
  | "approximate"
  | "lane-center"
  | "road-center"
  | "landmark";

export type AddressAccuracy = GeocodeMatchKind;

export type GeocodeHit = {
  id: string;
  name: string;
  address: string;
  location: LngLat;
  source?: "cache" | "tgos" | "nlsc" | "osm" | "google" | "local";
  exactHouseNumber?: boolean;
  matchKind?: GeocodeMatchKind;
  confidence?: number;
  distanceMeters?: number;
};

export type RouteDestination = {
  label: string;
  address: string;
  location: LngLat;
};

export type ParkingFill = "plenty" | "limited" | "full" | "unknown";
export type ParkingSort = "distance" | "remaining" | "price";
export type ParkingDataOrigin = "tdx-live" | "tainan-open" | "unavailable";

export type ParkingLot = {
  id: string;
  name: string;
  address?: string;
  location: LngLat;
  distanceMeters?: number;
  carAvailable?: number | null;
  carTotal?: number | null;
  motorcycleAvailable?: number | null;
  motorcycleTotal?: number | null;
  fee?: string;
  hours?: string;
  updatedAt?: string;
  source: string;
  origin: ParkingDataOrigin;
  freshness: DataFreshness;
  fill: ParkingFill;
};

export type ParkingCatalog = {
  origin: ParkingDataOrigin;
  lots: ParkingLot[];
  fetchedAt: string;
};

export type TravelMode = "car" | "motorcycle";

export type RoutePlan = {
  coordinates: [number, number][];
  distanceMeters: number;
  durationSeconds: number;
  destination: RouteDestination;
  maneuver: NavigationManeuver;
  steps: RouteStep[];
  travelMode: TravelMode;
};
