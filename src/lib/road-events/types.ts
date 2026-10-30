export type RoadEventType =
  | "accident"
  | "construction"
  | "congestion"
  | "control"
  | "weather"
  | "disaster"
  | "activity"
  | "abnormal"
  | "unknown";

export type LocationPrecision = "point" | "line" | "area" | "none";

export type RoadEventGeometry =
  | { type: "Point"; coordinates: [number, number] }
  | { type: "MultiPoint"; coordinates: [number, number][] }
  | { type: "LineString"; coordinates: [number, number][] }
  | { type: "MultiLineString"; coordinates: [number, number][][] }
  | { type: "Polygon"; coordinates: [number, number][][] }
  | { type: "MultiPolygon"; coordinates: [number, number][][][] };

export type NormalizedRoadEvent = {
  id: string;
  eventType: RoadEventType;
  eventTypeCode: number | null;
  severity: string | null;
  title: string | null;
  description: string | null;
  road: string | null;
  direction: string | null;
  startTime: string | null;
  endTime: string | null;
  source: string;
  sourceDataset: string;
  sourceUpdateTime: string | null;
  geometry: RoadEventGeometry | null;
  locationPrecision: LocationPrecision;
  permitId: string | null;
  city: string | null;
  dedupedWith: string[];
};

export type SourceNormalizeResult = {
  sourceDataset: string;
  ok: boolean;
  error: string | null;
  updateTime: string | null;
  rawCount: number;
  uniqueCount: number;
  byEventType: Record<string, number>;
  withCoordinates: number;
  activeCount: number;
  events: NormalizedRoadEvent[];
};

export const TDX_EVENT_TYPE_NAME: Record<number, RoadEventType> = {
  1: "accident",
  2: "construction",
  3: "congestion",
  4: "control",
  5: "weather",
  6: "disaster",
  7: "activity",
  8: "abnormal",
};
