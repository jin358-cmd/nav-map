import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { routeAvoidanceAuthorized } from "./proximity.mjs";

const TAIWAN = { west: 118, south: 21.5, east: 122.8, north: 26.6 };

export function textOrNull(value) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

export function hashRaw(value) {
  return createHash("sha256").update(JSON.stringify(value ?? null)).digest("hex");
}

function parseNumberPair(lng, lat) {
  const longitude = Number(lng);
  const latitude = Number(lat);
  if (!Number.isFinite(longitude) || !Number.isFinite(latitude)) return null;
  if (
    longitude < TAIWAN.west ||
    longitude > TAIWAN.east ||
    latitude < TAIWAN.south ||
    latitude > TAIWAN.north
  ) {
    return null;
  }
  return [longitude, latitude];
}

function parseWkt(value) {
  const match = value.trim().match(/^(POINT|LINESTRING)\s*\((.*)\)$/i);
  if (!match) return null;
  const kind = match[1].toUpperCase();
  const pairs = match[2]
    .split(",")
    .map((part) => part.trim().split(/\s+/).map(Number))
    .map(([lng, lat]) => parseNumberPair(lng, lat));
  if (pairs.some((pair) => !pair)) return null;
  if (kind === "POINT") {
    if (pairs.length !== 1) return null;
    return { type: "Point", coordinates: pairs[0] };
  }
  if (pairs.length < 2) return null;
  return { type: "LineString", coordinates: pairs };
}

/** Accept only WKT or GeoJSON that already lies inside Taiwan. Never geocode text. */
export function parseGeometry(value) {
  if (!value) return null;
  if (typeof value === "string") return parseWkt(value);
  if (typeof value !== "object") return null;
  if (value.type === "Point") {
    const pair = parseNumberPair(value.coordinates?.[0], value.coordinates?.[1]);
    return pair ? { type: "Point", coordinates: pair } : null;
  }
  if (value.type === "LineString" && Array.isArray(value.coordinates)) {
    const pairs = value.coordinates.map((pair) => parseNumberPair(pair?.[0], pair?.[1]));
    if (pairs.length < 2 || pairs.some((pair) => !pair)) return null;
    return { type: "LineString", coordinates: pairs };
  }
  return null;
}

function parseTime(value) {
  if (!value || typeof value !== "string") return null;
  const time = Date.parse(value);
  return Number.isFinite(time) ? time : null;
}

function windowState(record, nowMs) {
  const start = parseTime(record.scheduled_start);
  const end = parseTime(record.scheduled_end);
  if (start == null || end == null) return "unknown";
  if (nowMs < start) return "scheduled";
  if (nowMs > end) return "ended";
  return "active";
}

function normalizeRoadName(value) {
  return textOrNull(value)?.replaceAll("台", "臺") ?? null;
}

export function classifyRecord(raw, nowIso) {
  const nowMs = parseTime(nowIso) ?? Date.now();
  const geometry = parseGeometry(raw?.geometry);
  const requestedConfidence = textOrNull(raw?.geometry_confidence);
  const geometryConfidence = geometry
    ? requestedConfidence === "verified"
      ? "verified"
      : "reported"
    : "none";
  const direction = textOrNull(raw?.direction);
  const affectedLane = textOrNull(raw?.affected_lane);
  const closureClaim = raw?.closure_claim === "explicit" ? "explicit" : null;
  const state = windowState(
    {
      scheduled_start: textOrNull(raw?.scheduled_start),
      scheduled_end: textOrNull(raw?.scheduled_end),
    },
    nowMs,
  );
  const geoVerified = geometryConfidence === "verified";
  let displayClass = "stale_or_unknown";
  if (
    closureClaim === "explicit" &&
    geoVerified &&
    direction &&
    affectedLane &&
    state === "active"
  ) {
    displayClass = "closure_verified";
  } else if (geoVerified && direction && state === "active" && closureClaim !== "explicit") {
    displayClass = "verified_active";
  } else if (state === "scheduled" || state === "active") {
    displayClass = "official_notice";
  }

  const mapVisible = displayClass === "verified_active" || displayClass === "closure_verified";
  const sourceAgency = textOrNull(raw?.source_agency) ?? "unknown";
  const sourceId = textOrNull(raw?.source_id) ?? hashRaw(raw).slice(0, 16);

  return {
    id: `${sourceAgency}:${sourceId}`,
    source_id: sourceId,
    source_agency: sourceAgency,
    source_url: textOrNull(raw?.source_url),
    source_type: textOrNull(raw?.source_type) ?? "unknown",
    road_class: textOrNull(raw?.road_class),
    road_name: textOrNull(raw?.road_name),
    segment_text: textOrNull(raw?.segment_text),
    direction,
    affected_lane: affectedLane,
    description: textOrNull(raw?.description),
    published_at: textOrNull(raw?.published_at),
    scheduled_start: textOrNull(raw?.scheduled_start),
    scheduled_end: textOrNull(raw?.scheduled_end),
    updated_at: textOrNull(raw?.updated_at),
    ingested_at: nowIso,
    geometry,
    geometry_confidence: geometryConfidence,
    operational_status: state,
    closure_status:
      displayClass === "closure_verified"
        ? "verified"
        : closureClaim === "explicit"
          ? "claimed"
          : "unknown",
    last_verified_at: geoVerified ? textOrNull(raw?.last_verified_at) : null,
    raw_source_hash: hashRaw(raw),
    display_class: displayClass,
    map_visible: mapVisible,
    voice_eligible: mapVisible,
    closure_avoidance_eligible: displayClass === "closure_verified",
    related_ids: [],
  };
}

function stamp(record) {
  return parseTime(record.updated_at) ?? parseTime(record.published_at) ?? 0;
}

function windowsOverlap(left, right) {
  const leftStart = parseTime(left.scheduled_start);
  const leftEnd = parseTime(left.scheduled_end);
  const rightStart = parseTime(right.scheduled_start);
  const rightEnd = parseTime(right.scheduled_end);
  if ([leftStart, leftEnd, rightStart, rightEnd].some((value) => value == null)) return false;
  return leftStart <= rightEnd && rightStart <= leftEnd;
}

export function dedupeAndRelate(records) {
  const grouped = new Map();
  for (const record of records) {
    const key = `${record.source_agency}\n${record.source_id}`;
    const existing = grouped.get(key);
    if (!existing || stamp(record) >= stamp(existing)) grouped.set(key, record);
  }
  const unique = [...grouped.values()];
  for (let index = 0; index < unique.length; index += 1) {
    for (let other = index + 1; other < unique.length; other += 1) {
      const left = unique[index];
      const right = unique[other];
      if (left.source_agency === right.source_agency && left.source_id === right.source_id) continue;
      const leftRoad = normalizeRoadName(left.road_name);
      const rightRoad = normalizeRoadName(right.road_name);
      if (!leftRoad || leftRoad !== rightRoad) continue;
      if (!left.direction || left.direction !== right.direction) continue;
      if (!windowsOverlap(left, right)) continue;
      left.related_ids = [...new Set([...left.related_ids, right.id])];
      right.related_ids = [...new Set([...right.related_ids, left.id])];
    }
  }
  return unique;
}

export function buildCatalog(rawRecords, nowIso) {
  const classified = (rawRecords ?? []).map((raw) => classifyRecord(raw, nowIso));
  const events = dedupeAndRelate(classified);
  const mapEvents = events.filter((event) => event.map_visible && event.geometry);
  return {
    events,
    mapEvents,
    notices: events.filter((event) => !event.map_visible),
    counts: {
      input: rawRecords?.length ?? 0,
      unique: events.length,
      mapVisible: mapEvents.length,
      notices: events.filter((event) => !event.map_visible).length,
    },
    closureAvoidanceEnabled: routeAvoidanceAuthorized(),
  };
}

export function readJsonFixture(name) {
  const path = join(process.cwd(), "fixtures", "roadwork", name);
  return JSON.parse(readFileSync(path, "utf8"));
}

export function structuralCatalog(nowIso) {
  return buildCatalog(readJsonFixture("structural-notices.json"), nowIso);
}

export function gateCaseCatalog(nowIso) {
  return buildCatalog(readJsonFixture("gate-cases.json"), nowIso);
}

function roadway(location) {
  return (
    location?.CityRoad?.Roadways?.[0] ??
    location?.FreeExpressHighway ??
    location?.Highway ??
    null
  );
}

export function tdxEventToRaw(row) {
  const location = row?.Location ?? {};
  const road = roadway(location);
  const section = [textOrNull(road?.SectionStart), textOrNull(road?.SectionEnd)]
    .filter(Boolean)
    .join("–");
  const regulations = Array.isArray(row?.Impact?.Regulations) ? row.Impact.Regulations : [];
  const closureClaim = regulations.includes(1) ? "explicit" : null;
  return {
    source_id: textOrNull(row?.EventID),
    source_agency: textOrNull(row?.Authority?.AuthorityName) ?? "TDX",
    source_url: textOrNull(row?.WebURL),
    source_type: "tdx_road_event",
    road_class: textOrNull(location?.FreeExpressHighway?.Road) ? "highway" : "city",
    road_name: textOrNull(road?.Road),
    segment_text: section || textOrNull(location?.Other),
    direction: textOrNull(road?.Direction),
    affected_lane: textOrNull(row?.Impact?.BlockedLanes),
    description: textOrNull(row?.Description) ?? textOrNull(row?.EventTitle),
    published_at: textOrNull(row?.PublishTime),
    scheduled_start: textOrNull(row?.EffectiveTime),
    scheduled_end: textOrNull(row?.ExpireTime),
    updated_at: textOrNull(row?.UpdateTime),
    geometry: row?.Geometry ?? row?.Positions ?? null,
    geometry_confidence: "reported",
    closure_claim: closureClaim,
    last_verified_at: null,
  };
}

export function tdxPayloadToRaw(payload) {
  const rows = Array.isArray(payload)
    ? payload
    : Array.isArray(payload?.Events)
      ? payload.Events
      : Array.isArray(payload?.value)
        ? payload.value
        : [];
  return rows.map(tdxEventToRaw).filter((row) => row.source_id);
}

export function degradeTdxStatus(status, timedOut = false) {
  if (timedOut) return "timeout";
  if (status === 401 || status === 403) return "unauthorized";
  if (status === 429) return "rate_limited";
  if (status >= 500 || status === 0) return "upstream";
  return "upstream";
}

export function tdxFetchPlan(configured) {
  if (!configured) return { fetch: false, reason: "unconfigured" };
  return { fetch: true, reason: null };
}
