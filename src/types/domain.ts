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

export type CctvStatus = "online" | "offline" | "maintenance";

export type CctvCamera = {
  id: string;
  name: string;
  intersection: string;
  district: string;
  status: CctvStatus;
  location: LngLat;
  updatedAt: string;
  snapshotLabel: string;
};

export type TrafficLevel = "smooth" | "slow" | "congested" | "blocked";

export type TrafficSegment = {
  id: string;
  name: string;
  level: TrafficLevel;
  coordinates: [number, number][];
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
};

export type NavigationManeuver = {
  distanceMeters: number;
  action: string;
  roadName: string;
  hint: string;
  remainingKm: number;
  etaMinutes: number;
};
