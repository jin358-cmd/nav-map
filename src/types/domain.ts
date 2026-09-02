export type LngLat = {
  lng: number;
  lat: number;
};

export type VehiclePose = LngLat & {
  heading: number;
  accuracy?: number;
  source: "demo" | "gps";
};

export type GpsStatus =
  | "idle"
  | "locating"
  | "active"
  | "denied"
  | "unavailable";

export type CameraMode = "2d" | "3d";

export type CctvStatus = "online" | "offline" | "unknown" | "unsupported";
export type CctvSourceType = "city" | "freeway";
export type CctvDataOrigin = "tdx-live" | "snapshot" | "mock";

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

export type TrafficLevel = "smooth" | "slow" | "congested" | "blocked";
export type TrafficSourceType = "city" | "freeway";
export type TrafficDataOrigin = "tdx-live" | "mock";

export type TrafficSegment = {
  id: string;
  name: string;
  level: TrafficLevel;
  coordinates: [number, number][];
  sourceType: TrafficSourceType;
  dataOrigin: TrafficDataOrigin;
  speedKmh?: number;
  travelTimeSec?: number;
  congestionLabel?: string;
  updatedAt?: string;
};

export type TrafficCatalog = {
  origin: TrafficDataOrigin;
  segments: TrafficSegment[];
  fetchedAt: string;
};

export type DisasterKind = "flood" | "closure" | "quake" | "typhoon";

export type DisasterAlert = {
  id: string;
  kind: DisasterKind;
  title: string;
  description: string;
  location: LngLat;
  severity: "watch" | "warning";
};

export type AccidentReport = {
  id: string;
  title: string;
  description: string;
  location: LngLat;
};

export type RoadIntelKind = "cctv" | "construction" | "congestion" | "accident" | "disaster";

export type RoadIntelItem = {
  id: string;
  kind: RoadIntelKind;
  title: string;
  detail: string;
  distanceMeters: number;
  cameraId?: string;
};

export type NavigationManeuver = {
  distanceMeters: number;
  action: string;
  roadName: string;
  hint: string;
  remainingKm: number;
  etaMinutes: number;
};

export type GeocodeHit = {
  id: string;
  name: string;
  address: string;
  location: LngLat;
};

export type RouteDestination = {
  label: string;
  address: string;
  location: LngLat;
};

export type RoutePlan = {
  coordinates: [number, number][];
  distanceMeters: number;
  durationSeconds: number;
  destination: RouteDestination;
  maneuver: NavigationManeuver;
};
