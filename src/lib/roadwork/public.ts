export type RoadworkDisplayClass =
  | "official_notice"
  | "verified_active"
  | "stale_or_unknown"
  | "closure_verified";

export type RoadworkGeometry =
  | { type: "Point"; coordinates: [number, number] }
  | { type: "LineString"; coordinates: [number, number][] };

export type RoadworkEvent = {
  id: string;
  source_id: string;
  source_agency: string;
  source_url: string | null;
  source_type: string;
  road_class: string | null;
  road_name: string | null;
  segment_text: string | null;
  direction: string | null;
  affected_lane: string | null;
  description: string | null;
  published_at: string | null;
  scheduled_start: string | null;
  scheduled_end: string | null;
  updated_at: string | null;
  ingested_at: string;
  geometry: RoadworkGeometry | null;
  geometry_confidence: "none" | "reported" | "verified";
  operational_status: "unknown" | "scheduled" | "active" | "ended";
  closure_status: "unknown" | "claimed" | "verified";
  last_verified_at: string | null;
  raw_source_hash: string;
  display_class: RoadworkDisplayClass;
  map_visible: boolean;
  voice_eligible: boolean;
  closure_avoidance_eligible: boolean;
  related_ids: string[];
};

export type RoadworkOrigin =
  | "empty"
  | "structural-fixture"
  | "tdx"
  | "degraded";

export type RoadworkCatalogResponse = {
  origin: RoadworkOrigin;
  degradedReason:
    | null
    | "unconfigured"
    | "unauthorized"
    | "rate_limited"
    | "upstream"
    | "timeout"
    | "empty";
  fetchedAt: string;
  previewLabel: string | null;
  mapEvents: RoadworkEvent[];
  notices: RoadworkEvent[];
  counts: {
    input: number;
    unique: number;
    mapVisible: number;
    notices: number;
  };
  closureAvoidanceEnabled: false;
};

export const ROADWORK_CLASS_LABEL: Record<RoadworkDisplayClass, string> = {
  official_notice: "公告",
  verified_active: "已確認施工",
  stale_or_unknown: "資訊不足或已過期",
  closure_verified: "已確認封路",
};

export function roadworkField(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : "尚未確認";
}
