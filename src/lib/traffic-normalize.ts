import { parseWktLine } from "@/lib/traffic-wkt";
import type {
  TrafficDataOrigin,
  TrafficLevel,
  TrafficSegment,
  TrafficSourceType,
} from "@/types/domain";

export type TdxLiveRow = {
  SectionID?: string;
  TravelTime?: number;
  TravelSpeed?: number;
  CongestionLevelID?: string | number;
  CongestionLevel?: string | number;
  DataCollectTime?: string;
};

export type TdxSectionRow = {
  SectionID?: string;
  SectionName?: string;
  RoadName?: string;
  Direction?: string;
  RoadDirection?: string;
};

export type TrafficSegmentSeed = {
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
  direction?: string;
};

export function finalizeTrafficSegment(
  seed: TrafficSegmentSeed,
): TrafficSegment {
  return {
    ...seed,
    roadName: seed.name,
    direction: seed.direction?.trim() || "",
    congestionLevel: seed.level,
    source:
      seed.dataOrigin === "tdx-live"
        ? "tdx"
        : seed.dataOrigin === "unavailable"
          ? "unavailable"
          : "mock",
    averageSpeed: seed.speedKmh,
  };
}

export type TdxShapeRow = {
  SectionID?: string;
  Geometry?: string;
};

export function unwrapTdxList<T>(
  payload: unknown,
  keys: string[],
): T[] {
  if (Array.isArray(payload)) return payload as T[];
  if (!payload || typeof payload !== "object") return [];
  const record = payload as Record<string, unknown>;
  for (const key of keys) {
    const value = record[key];
    if (Array.isArray(value)) return value as T[];
  }
  return [];
}

/**
 * MOTC LevelItem:
 * -1 道路封閉, 0 未知, 1 順暢, 2 車多, 3 壅塞, 4 嚴重壅塞, 5 極度壅塞
 * LiveTraffic.CongestionLevel also documents -99 資料異常.
 */
export function mapCongestionLevel(
  level: string | number | undefined,
  levelId: string | number | undefined,
  speed: number | undefined,
): TrafficLevel | null {
  const byName = classifyByName(level) ?? classifyByName(levelId);
  if (byName) return byName;

  const numeric = toInt(level);
  const mapped = classifyByCode(numeric);
  if (mapped) return mapped;
  if (numeric === 0 || numeric === -99) {
    return classifyBySpeed(speed);
  }

  const idMapped = classifyByCode(toInt(levelId));
  if (idMapped) return idMapped;

  return classifyBySpeed(speed);
}

export function classifyBySpeed(speed: number | undefined): TrafficLevel | null {
  if (!Number.isFinite(speed) || (speed as number) < 0) return null;
  if ((speed as number) >= 40) return "smooth";
  if ((speed as number) >= 25) return "slow";
  if ((speed as number) >= 10) return "congested";
  if ((speed as number) >= 5) return "severe";
  return "blocked";
}

export function joinTrafficSegments({
  lives,
  sections,
  shapes,
  origin,
  sourceType = "city",
}: {
  lives: TdxLiveRow[];
  sections: TdxSectionRow[];
  shapes: TdxShapeRow[];
  origin: TrafficDataOrigin;
  sourceType?: TrafficSourceType;
}): TrafficSegment[] {
  const sectionById = new Map<string, TdxSectionRow>();
  for (const section of sections) {
    if (section.SectionID) sectionById.set(section.SectionID, section);
  }
  const shapeById = new Map<string, TdxShapeRow>();
  for (const shape of shapes) {
    if (shape.SectionID) shapeById.set(shape.SectionID, shape);
  }

  const segments: TrafficSegment[] = [];
  for (const live of lives) {
    const id = live.SectionID?.trim();
    if (!id) continue;
    const shape = shapeById.get(id);
    const coordinates = shape?.Geometry ? parseWktLine(shape.Geometry) : null;
    if (!coordinates) continue;

    const speed =
      Number.isFinite(live.TravelSpeed) && (live.TravelSpeed as number) >= 0
        ? Number(live.TravelSpeed)
        : undefined;
    const level = mapCongestionLevel(
      live.CongestionLevel,
      live.CongestionLevelID,
      speed,
    );
    if (!level) continue;

    const meta = sectionById.get(id);
    const name =
      meta?.SectionName?.trim() ||
      meta?.RoadName?.trim() ||
      id;
    const travelTime =
      Number.isFinite(live.TravelTime) && (live.TravelTime as number) >= 0
        ? Number(live.TravelTime)
        : undefined;

    segments.push(
      finalizeTrafficSegment({
        id,
        name,
        level,
        coordinates,
        sourceType,
        dataOrigin: origin,
        speedKmh: speed,
        travelTimeSec: travelTime,
        congestionLabel: String(live.CongestionLevel ?? "").trim() || undefined,
        updatedAt: live.DataCollectTime,
        direction:
          meta?.Direction?.trim() || meta?.RoadDirection?.trim() || "",
      }),
    );
  }
  return segments;
}

function classifyByName(value: string | number | undefined): TrafficLevel | null {
  if (value === undefined || value === null) return null;
  const text = String(value).trim();
  if (!text) return null;
  if (/封閉|中斷/.test(text)) return "blocked";
  if (/極度|接近停止|停止/.test(text)) return "blocked";
  if (/阻塞/.test(text)) return "blocked";
  if (/嚴重壅塞/.test(text)) return "severe";
  if (/壅塞|回堵/.test(text)) return "congested";
  if (/車多|緩慢|遲滯/.test(text)) return "slow";
  if (/順暢|暢通/.test(text)) return "smooth";
  return null;
}

function classifyByCode(value: number | null): TrafficLevel | null {
  if (value === null) return null;
  if (value === -1 || value >= 5) return "blocked";
  if (value === 4) return "severe";
  if (value === 1) return "smooth";
  if (value === 2) return "slow";
  if (value === 3) return "congested";
  return null;
}

function toInt(value: string | number | undefined): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string") return null;
  const parsed = Number(value.trim());
  return Number.isFinite(parsed) ? parsed : null;
}
