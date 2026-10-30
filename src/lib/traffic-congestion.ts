import { padBounds, type TrafficBounds } from "@/lib/traffic-cities";
import { parseWktLine } from "@/lib/traffic-wkt";
import {
  finalizeTrafficSegment,
  type TdxLiveRow,
  type TdxSectionRow,
  type TdxShapeRow,
} from "@/lib/traffic-normalize";
import type {
  CongestionBand,
  TrafficDataOrigin,
  TrafficLevel,
  TrafficSegment,
  TrafficSourceType,
} from "@/types/domain";

export {
  isLiveTrafficCity,
  liveTrafficCityAt,
  trafficCityBounds,
  TDX_LIVE_TRAFFIC_CITIES,
} from "@/lib/traffic-cities";
export type { LiveTrafficCity, TrafficBounds } from "@/lib/traffic-cities";

export type TdxLinkIdItem = { LinkID?: string };

export type TdxLinkRow = {
  SectionID?: string;
  SubAuthorityCode?: string;
  StartLinkID?: string;
  EndLinkID?: string;
  LinkIDs?: TdxLinkIdItem[];
};

export type TdxLevelItem = {
  Level?: number;
  LevelName?: string;
};

export type TdxCongestionDefinition = {
  CongestionLevelID?: string;
  SubAuthorityCode?: string;
  CongestionLevelName?: string;
  MeasureIndex?: string;
  Levels?: TdxLevelItem[];
};

export type TdxEnvelope<T> = {
  authorityCode: string;
  updateTime?: string;
  updateIntervalSec?: number;
  count?: number;
  items: T[];
};

export type CongestionStats = {
  city: string;
  cityLive: number;
  highwayLive: number;
  highwayInCounty: number;
  sectionsFetched: number;
  geometryMatched: number;
  endpointFallback: number;
  unmatchedGeometry: number;
  green: number;
  yellow: number;
  red: number;
  unknown: number;
  sectionLinks: number;
  definitionGroups: number;
};

export type CountyTrafficBundle = {
  live: TdxEnvelope<TdxLiveRow>;
  sections: TdxEnvelope<TdxSectionRow>;
  shapes: TdxEnvelope<TdxShapeRow>;
  links: TdxEnvelope<TdxLinkRow>;
  levels: TdxEnvelope<TdxCongestionDefinition>;
};

const EMPTY_STATS = {
  cityLive: 0,
  highwayLive: 0,
  highwayInCounty: 0,
  sectionsFetched: 0,
  geometryMatched: 0,
  endpointFallback: 0,
  unmatchedGeometry: 0,
  green: 0,
  yellow: 0,
  red: 0,
  unknown: 0,
  sectionLinks: 0,
  definitionGroups: 0,
};

export function readTdxEnvelope<T>(
  payload: unknown,
  legacyKeys: string[] = [],
): TdxEnvelope<T> {
  if (Array.isArray(payload)) {
    return { authorityCode: "", items: payload as T[], count: payload.length };
  }
  if (!payload || typeof payload !== "object") {
    return { authorityCode: "", items: [] };
  }
  const record = payload as Record<string, unknown>;
  let items: T[] = [];
  if (Array.isArray(record.Items)) {
    items = record.Items as T[];
  } else {
    for (const key of legacyKeys) {
      const value = record[key];
      if (Array.isArray(value)) {
        items = value as T[];
        break;
      }
    }
  }
  return {
    authorityCode:
      typeof record.AuthorityCode === "string" ? record.AuthorityCode : "",
    updateTime: typeof record.UpdateTime === "string" ? record.UpdateTime : undefined,
    updateIntervalSec:
      typeof record.UpdateInterval === "number" ? record.UpdateInterval : undefined,
    count: typeof record.Count === "number" ? record.Count : undefined,
    items,
  };
}

export function lineOverlapsBounds(
  line: [number, number][],
  bounds: TrafficBounds,
): boolean {
  for (let index = 0; index < line.length; index += 1) {
    const [lng, lat] = line[index];
    if (contains(lng, lat, bounds)) return true;
    if (index === 0) continue;
    const [previousLng, previousLat] = line[index - 1];
    if (
      contains((lng + previousLng) / 2, (lat + previousLat) / 2, bounds)
    ) {
      return true;
    }
  }
  return false;
}

export function trafficCacheDecision(
  ageMs: number,
  ttlMs: number,
  force: boolean,
  minRefreshMs: number,
): "hit" | "miss" {
  if (!Number.isFinite(ageMs)) return "miss";
  if (force) return ageMs < minRefreshMs ? "hit" : "miss";
  return ageMs < ttlMs ? "hit" : "miss";
}

type TaggedDefinition = TdxCongestionDefinition & { authorityCode: string };

export function buildCountyTraffic({
  city,
  origin,
  cityBundle,
  highwayBundle,
  bounds,
}: {
  city: string;
  origin: TrafficDataOrigin;
  cityBundle: CountyTrafficBundle;
  highwayBundle?: CountyTrafficBundle | null;
  bounds?: TrafficBounds | null;
}): { segments: TrafficSegment[]; stats: CongestionStats } {
  const clip = bounds ? padBounds(bounds) : null;
  const cityJoined = joinDataset({
    bundle: cityBundle,
    origin,
    sourceType: "city",
    bounds: null,
  });
  const highwayJoined = highwayBundle
    ? joinDataset({
        bundle: highwayBundle,
        origin,
        sourceType: "highway",
        bounds: clip,
      })
    : null;

  const segments = [...cityJoined.segments, ...(highwayJoined?.segments ?? [])];
  const stats: CongestionStats = {
    city,
    cityLive: cityJoined.candidates,
    highwayLive: highwayBundle?.live.items.length ?? 0,
    highwayInCounty: highwayJoined?.candidates ?? 0,
    sectionsFetched: cityJoined.candidates + (highwayJoined?.candidates ?? 0),
    geometryMatched:
      cityJoined.geometryMatched + (highwayJoined?.geometryMatched ?? 0),
    endpointFallback:
      cityJoined.endpointFallback + (highwayJoined?.endpointFallback ?? 0),
    unmatchedGeometry:
      cityJoined.unmatchedGeometry + (highwayJoined?.unmatchedGeometry ?? 0),
    green: 0,
    yellow: 0,
    red: 0,
    unknown: 0,
    sectionLinks: cityJoined.sectionLinks + (highwayJoined?.sectionLinks ?? 0),
    definitionGroups:
      cityBundle.levels.items.length + (highwayBundle?.levels.items.length ?? 0),
  };
  for (const segment of segments) {
    stats[segment.congestionBand] += 1;
  }
  return { segments, stats };
}

export function envelopesFromBundle(bundle: {
  live: unknown;
  sections: unknown;
  shapes: unknown;
  links: unknown;
  levels: unknown;
}): CountyTrafficBundle {
  return {
    live: readTdxEnvelope<TdxLiveRow>(bundle.live, ["LiveTraffics", "liveTraffics"]),
    sections: readTdxEnvelope<TdxSectionRow>(bundle.sections, [
      "Sections",
      "sections",
    ]),
    shapes: readTdxEnvelope<TdxShapeRow>(bundle.shapes, [
      "SectionShapes",
      "sectionShapes",
    ]),
    links: readTdxEnvelope<TdxLinkRow>(bundle.links, [
      "SectionLinks",
      "sectionLinks",
    ]),
    levels: readTdxEnvelope<TdxCongestionDefinition>(bundle.levels, [
      "CongestionLevels",
      "congestionLevels",
    ]),
  };
}

function joinDataset({
  bundle,
  origin,
  sourceType,
  bounds,
}: {
  bundle: CountyTrafficBundle;
  origin: TrafficDataOrigin;
  sourceType: TrafficSourceType;
  bounds: TrafficBounds | null;
}): {
  segments: TrafficSegment[];
  candidates: number;
  geometryMatched: number;
  endpointFallback: number;
  unmatchedGeometry: number;
  sectionLinks: number;
} {
  const sections = indexById(bundle.sections.items);
  const shapes = indexById(bundle.shapes.items);
  const links = indexById(bundle.links.items);
  const definitions = tagDefinitions(bundle.levels);
  const counts = {
    segments: [] as TrafficSegment[],
    candidates: 0,
    geometryMatched: 0,
    endpointFallback: 0,
    unmatchedGeometry: 0,
    sectionLinks: 0,
  };

  for (const live of bundle.live.items) {
    const sectionId = live.SectionID?.trim();
    if (!sectionId) continue;
    const section = sections.get(sectionId);
    const shape = shapes.get(sectionId);
    const wkt = shape?.Geometry ? parseWktLine(shape.Geometry) : null;
    const endpoints = section ? endpointLine(section) : null;
    const line = wkt ?? endpoints;
    if (bounds && (!line || !lineOverlapsBounds(line, bounds))) continue;

    counts.candidates += 1;
    const link = links.get(sectionId);
    if (link) counts.sectionLinks += 1;
    if (!line) {
      counts.unmatchedGeometry += 1;
      continue;
    }
    if (wkt) counts.geometryMatched += 1;
    else counts.endpointFallback += 1;

    const resolved = resolveLiveCongestion(
      live,
      bundle.live.authorityCode,
      definitions,
    );
    const name =
      section?.SectionName?.trim() ||
      section?.RoadName?.trim() ||
      sectionId;
    const speed =
      Number.isFinite(live.TravelSpeed) && (live.TravelSpeed as number) >= 0
        ? Number(live.TravelSpeed)
        : undefined;
    const travelTime =
      Number.isFinite(live.TravelTime) && (live.TravelTime as number) >= 0
        ? Number(live.TravelTime)
        : undefined;

    counts.segments.push(
      finalizeTrafficSegment({
        id: `${sourceType}:${bundle.live.authorityCode || "tdx"}:${sectionId}`,
        name,
        level: resolved.level,
        congestionBand: resolved.band,
        coordinates: line,
        sourceType,
        dataOrigin: origin,
        speedKmh: speed,
        travelTimeSec: travelTime,
        congestionLabel: resolved.label,
        updatedAt: live.DataCollectTime,
        direction:
          section?.RoadDirection?.trim() || section?.Direction?.trim() || "",
      }),
    );
  }

  return counts;
}

export function resolveLiveCongestion(
  live: TdxLiveRow,
  authorityCode: string,
  definitions: TaggedDefinition[],
): { band: CongestionBand; level: TrafficLevel; label: string } {
  const raw = live.CongestionLevel;
  const numeric = parseLevelCode(raw);
  if (numeric === -99 || String(raw ?? "").trim() === "-99") {
    return { band: "unknown", level: "unknown", label: "資料異常" };
  }

  const group = findDefinition(
    definitions,
    authorityCode,
    text(live.CongestionLevelID),
    text(live.SubAuthorityCode),
  );
  const matched = group ? matchLevelItem(group, raw) : null;
  const band = matched
    ? bandFromAgencyLevel(matched.Level ?? null, matched.LevelName ?? null)
    : bandFromRaw(raw, numeric);
  const label =
    matched?.LevelName?.trim() ||
    (raw === undefined || raw === null || String(raw).trim() === ""
      ? "未知"
      : String(raw).trim());
  return {
    band,
    level: trafficLevelFor(band, matched?.Level ?? numeric),
    label,
  };
}

function bandFromAgencyLevel(
  level: number | null,
  levelName: string | null,
): CongestionBand {
  const name = levelName?.trim() ?? "";
  if (name) {
    if (/異常|未知|資料不足|無資料/.test(name)) return "unknown";
    if (/封閉|中斷|極度|阻塞|嚴重|壅塞|回堵/.test(name)) return "red";
    if (/車多|緩慢|遲滯/.test(name)) return "yellow";
    if (/順暢|暢通/.test(name)) return "green";
  }
  return bandFromCode(level);
}

function bandFromRaw(
  raw: string | number | undefined,
  numeric: number | null,
): CongestionBand {
  const named = bandFromAgencyLevel(null, raw === undefined ? null : String(raw));
  if (raw !== undefined && raw !== null && String(raw).trim() && named !== "unknown") {
    return named;
  }
  if (numeric === null && (raw === undefined || String(raw).trim() === "")) {
    return "unknown";
  }
  return bandFromCode(numeric);
}

function bandFromCode(level: number | null): CongestionBand {
  if (level === null || level === 0 || level === -99) return "unknown";
  if (level === 1) return "green";
  if (level === 2) return "yellow";
  if (level === -1 || level >= 3) return "red";
  return "unknown";
}

function trafficLevelFor(band: CongestionBand, numeric: number | null): TrafficLevel {
  if (band === "unknown") return "unknown";
  if (band === "green") return "smooth";
  if (band === "yellow") return "slow";
  if (numeric === -1 || (numeric !== null && numeric >= 5)) return "blocked";
  if (numeric === 4) return "severe";
  return "congested";
}

function findDefinition(
  definitions: TaggedDefinition[],
  authorityCode: string,
  groupId: string,
  subAuthority: string,
): TaggedDefinition | null {
  if (!groupId) return null;
  const groups = definitions.filter(
    (item) =>
      item.authorityCode === authorityCode &&
      text(item.CongestionLevelID) === groupId,
  );
  if (!groups.length) return null;
  if (subAuthority) {
    const exact = groups.find((item) => text(item.SubAuthorityCode) === subAuthority);
    if (exact) return exact;
  }
  return groups.find((item) => !text(item.SubAuthorityCode)) ?? groups[0] ?? null;
}

function matchLevelItem(
  group: TaggedDefinition,
  raw: string | number | undefined,
): TdxLevelItem | null {
  const levels = group.Levels ?? [];
  const numeric = parseLevelCode(raw);
  if (numeric !== null) {
    const byCode = levels.find((item) => item.Level === numeric);
    if (byCode) return byCode;
  }
  const name = text(raw);
  if (!name) return null;
  return levels.find((item) => text(item.LevelName) === name) ?? null;
}

function tagDefinitions(levels: TdxEnvelope<TdxCongestionDefinition>): TaggedDefinition[] {
  return levels.items.map((item) => ({
    ...item,
    authorityCode: levels.authorityCode,
  }));
}

function indexById<T extends { SectionID?: string }>(items: T[]): Map<string, T> {
  const map = new Map<string, T>();
  for (const item of items) {
    const id = item.SectionID?.trim();
    if (id) map.set(id, item);
  }
  return map;
}

function endpointLine(section: TdxSectionRow): [number, number][] | null {
  const start = readPoint(section.SectionStart);
  const end = readPoint(section.SectionEnd);
  if (!start || !end) return null;
  if (start[0] === end[0] && start[1] === end[1]) return null;
  return [start, end];
}

function readPoint(
  point: TdxSectionRow["SectionStart"],
): [number, number] | null {
  if (!point) return null;
  const lng = point.PositionLon;
  const lat = point.PositionLat;
  if (!Number.isFinite(lng) || !Number.isFinite(lat)) return null;
  return [Number(lng), Number(lat)];
}

function parseLevelCode(value: string | number | undefined): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

function text(value: unknown): string {
  return typeof value === "string" || typeof value === "number"
    ? String(value).trim()
    : "";
}

function contains(lng: number, lat: number, bounds: TrafficBounds) {
  return (
    lng >= bounds.minLng &&
    lng <= bounds.maxLng &&
    lat >= bounds.minLat &&
    lat <= bounds.maxLat
  );
}

export function emptyCongestionStats(city: string): CongestionStats {
  return { city, ...EMPTY_STATS };
}
