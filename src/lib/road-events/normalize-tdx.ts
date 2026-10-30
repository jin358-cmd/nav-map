import {
  geometryUsable,
  precisionOf,
  precisionRank,
} from "./geometry";
import type { NormalizedRoadEvent, RoadEventGeometry, SourceNormalizeResult } from "./types";
import { TDX_EVENT_TYPE_NAME as TYPE_NAME } from "./types";
import { parseWkt } from "./wkt";

function text(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

export function extractLiveEvents(payload: unknown): {
  updateTime: string | null;
  rows: Record<string, unknown>[];
} {
  if (Array.isArray(payload)) {
    return {
      updateTime: null,
      rows: payload.filter((row): row is Record<string, unknown> => asRecord(row) !== null),
    };
  }
  const record = asRecord(payload);
  if (!record) return { updateTime: null, rows: [] };
  const rows = record.LiveEvents;
  return {
    updateTime: text(record.UpdateTime),
    rows: Array.isArray(rows)
      ? rows.filter((row): row is Record<string, unknown> => asRecord(row) !== null)
      : [],
  };
}

function pushWkt(target: RoadEventGeometry[], value: unknown) {
  const wkt = text(value);
  if (!wkt) return;
  const geometry = parseWkt(wkt);
  if (geometry && geometryUsable(geometry)) target.push(geometry);
}

function geometryFromRow(row: Record<string, unknown>): RoadEventGeometry | null {
  const found: RoadEventGeometry[] = [];
  pushWkt(found, row.Geometry);
  if (typeof row.Positions === "string") pushWkt(found, row.Positions);
  if (Array.isArray(row.Positions)) {
    for (const item of row.Positions) {
      const record = asRecord(item);
      if (!record) continue;
      pushWkt(found, record.Geometry);
    }
  }
  found.sort(
    (left, right) => precisionRank(precisionOf(right)) - precisionRank(precisionOf(left)),
  );
  return found[0] ?? null;
}

function roadFromLocation(location: unknown): { road: string | null; direction: string | null } {
  const record = asRecord(location);
  if (!record) return { road: null, direction: null };
  const highway = asRecord(record.FreeExpressHighway) ?? asRecord(record.Highway);
  if (highway) {
    return { road: text(highway.Road), direction: text(highway.Direction) };
  }
  const city = asRecord(record.CityRoad);
  const roadways = city && Array.isArray(city.Roadways) ? city.Roadways : [];
  const first = asRecord(roadways[0]);
  if (first) return { road: text(first.Road), direction: text(first.Direction) };
  return { road: text(record.Other), direction: null };
}

function eventTypeCode(value: unknown): number | null {
  const code = typeof value === "number" ? value : Number(value);
  return Number.isInteger(code) ? code : null;
}

export function normalizeTdxLivePayload(
  payload: unknown,
  source: { id: string; city: string | null; label: string },
): SourceNormalizeResult {
  const extracted = extractLiveEvents(payload);
  const byEventType: Record<string, number> = {};
  const seen = new Map<string, NormalizedRoadEvent>();
  for (const row of extracted.rows) {
    const code = eventTypeCode(row.EventType);
    const eventType = (code != null && TYPE_NAME[code]) || "unknown";
    const eventId = text(row.EventID) ?? "";
    const geometry = geometryFromRow(row);
    const precision = precisionOf(geometry);
    const road = roadFromLocation(row.Location);
    const level = row.EventLevel;
    const severity =
      typeof level === "number" || (typeof level === "string" && level.trim())
        ? String(level).trim()
        : null;
    const event: NormalizedRoadEvent = {
      id: `${source.id}:${eventId || "missing"}`,
      eventType,
      eventTypeCode: code,
      severity,
      title: text(row.EventTitle),
      description: text(row.Description),
      road: road.road,
      direction: road.direction,
      startTime: text(row.EffectiveTime) ?? text(row.PublishTime),
      endTime: text(row.ExpireTime),
      source: text(row.Source) ?? source.label,
      sourceDataset: source.id,
      sourceUpdateTime: extracted.updateTime,
      geometry,
      locationPrecision: precision,
      permitId: null,
      city: source.city,
      dedupedWith: [],
    };
    const key = eventId || event.id;
    const previous = seen.get(key);
    if (!previous || precisionRank(precision) >= precisionRank(previous.locationPrecision)) {
      seen.set(key, event);
    }
  }
  const events = [...seen.values()];
  for (const event of events) {
    const key = String(event.eventTypeCode ?? "unknown");
    byEventType[key] = (byEventType[key] ?? 0) + 1;
  }
  return {
    sourceDataset: source.id,
    ok: true,
    error: null,
    updateTime: extracted.updateTime,
    rawCount: extracted.rows.length,
    uniqueCount: events.length,
    byEventType,
    withCoordinates: events.filter((event) => event.locationPrecision !== "none").length,
    activeCount: events.length,
    events,
  };
}
