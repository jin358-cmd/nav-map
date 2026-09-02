import { TAINAN_TRAFFIC } from "@/data/mock-traffic";
import {
  TRAFFIC_LIVE_CACHE_MS,
  TRAFFIC_SHAPE_CACHE_MS,
} from "@/lib/traffic-constants";
import { joinTrafficSegments } from "@/lib/traffic-normalize";
import {
  fetchTainanCityLive,
  fetchTainanCitySections,
  fetchTainanCityShapes,
  isTdxConfigured,
} from "@/services/tdx-client";
import type { TrafficDataOrigin, TrafficSegment } from "@/types/domain";

export type TrafficCatalog = {
  origin: TrafficDataOrigin;
  segments: TrafficSegment[];
  fetchedAt: string;
};

type ShapeBundle = {
  sections: Awaited<ReturnType<typeof fetchTainanCitySections>>;
  shapes: Awaited<ReturnType<typeof fetchTainanCityShapes>>;
  fetchedAt: number;
};

let liveCache: TrafficCatalog | null = null;
let liveCacheAt = 0;
let shapeCache: ShapeBundle | null = null;

export async function loadTainanTraffic(
  force = false,
): Promise<TrafficCatalog> {
  if (
    !force &&
    liveCache &&
    Date.now() - liveCacheAt < TRAFFIC_LIVE_CACHE_MS
  ) {
    return liveCache;
  }

  const live = await fromTdxLive(force);
  const catalog = live ?? fromMock();
  liveCache = catalog;
  liveCacheAt = Date.now();
  return catalog;
}

function fromMock(): TrafficCatalog {
  return {
    origin: "mock",
    segments: TAINAN_TRAFFIC.map((segment) => ({
      ...segment,
      dataOrigin: "mock",
    })),
    fetchedAt: new Date().toISOString(),
  };
}

async function fromTdxLive(force: boolean): Promise<TrafficCatalog | null> {
  if (!isTdxConfigured()) return null;

  try {
    const [lives, shapes] = await Promise.all([
      fetchTainanCityLive(),
      loadShapes(force),
    ]);
    if (!lives.length || !shapes.shapes.length) return null;

    const segments = joinTrafficSegments({
      lives,
      sections: shapes.sections,
      shapes: shapes.shapes,
      origin: "tdx-live",
      sourceType: "city",
    });
    if (!segments.length) return null;

    return {
      origin: "tdx-live",
      segments,
      fetchedAt: new Date().toISOString(),
    };
  } catch (error) {
    console.warn("TDX live traffic fallback to mock", error);
    return null;
  }
}

async function loadShapes(force: boolean): Promise<ShapeBundle> {
  if (
    !force &&
    shapeCache &&
    Date.now() - shapeCache.fetchedAt < TRAFFIC_SHAPE_CACHE_MS
  ) {
    return shapeCache;
  }

  const [sections, shapes] = await Promise.all([
    fetchTainanCitySections(),
    fetchTainanCityShapes(),
  ]);
  shapeCache = { sections, shapes, fetchedAt: Date.now() };
  return shapeCache;
}
