import "server-only";
import { TAINAN_TRAFFIC } from "@/data/mock-traffic";
import { isDemoDataEnabled } from "@/lib/runtime-demo";
import {
  TRAFFIC_LIVE_CACHE_MS,
  TRAFFIC_SHAPE_CACHE_MS,
} from "@/lib/traffic-constants";
import {
  finalizeTrafficSegment,
  joinTrafficSegments,
} from "@/lib/traffic-normalize";
import {
  fetchTainanCityLive,
  fetchTainanCitySections,
  fetchTainanCityShapes,
  isTdxConfigured,
} from "@/services/tdx-client";
import type { TrafficCatalog, TrafficDataOrigin } from "@/types/domain";

export type { TrafficCatalog };

function catalogMeta(
  origin: TrafficDataOrigin,
  fetchedAt: string,
  stale = false,
): Pick<TrafficCatalog, "source" | "updatedAt" | "stale"> {
  return {
    source:
      origin === "tdx-live" ? "tdx" : origin === "unavailable" ? "unavailable" : "mock",
    updatedAt: fetchedAt,
    stale,
  };
}

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
  if (live) {
    liveCache = live;
    liveCacheAt = Date.now();
    return live;
  }
  if (isDemoDataEnabled()) {
    const catalog = fromMock();
    liveCache = catalog;
    liveCacheAt = Date.now();
    return catalog;
  }
  const fetchedAt = new Date().toISOString();
  const empty: TrafficCatalog = {
    origin: "unavailable",
    segments: [],
    fetchedAt,
    ...catalogMeta("unavailable", fetchedAt),
  };
  liveCache = empty;
  liveCacheAt = Date.now();
  return empty;
}

function fromMock(): TrafficCatalog {
  const now = new Date().toISOString();
  return {
    origin: "mock",
    segments: TAINAN_TRAFFIC.map((segment) =>
      finalizeTrafficSegment({
        ...segment,
        dataOrigin: "mock",
        updatedAt: now,
      }),
    ),
    fetchedAt: now,
    ...catalogMeta("mock", now),
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

    const fetchedAt = new Date().toISOString();
    return {
      origin: "tdx-live",
      segments,
      fetchedAt,
      ...catalogMeta("tdx-live", fetchedAt),
    };
  } catch (error) {
    console.warn(
      "TDX live traffic unavailable",
      error instanceof Error ? error.message : "unknown error",
    );
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
