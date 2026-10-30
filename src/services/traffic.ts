import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { TAINAN_TRAFFIC } from "@/data/mock-traffic";
import {
  buildCountyTraffic,
  emptyCongestionStats,
  envelopesFromBundle,
  trafficCacheDecision,
  type CongestionStats,
  type CountyTrafficBundle,
} from "@/lib/traffic-congestion";
import { trafficCityBounds } from "@/lib/traffic-cities";
import { isDemoDataEnabled } from "@/lib/runtime-demo";
import {
  TRAFFIC_LIVE_CACHE_MS,
  TRAFFIC_MIN_REFRESH_MS,
  TRAFFIC_SHAPE_CACHE_MS,
  TRAFFIC_STALE_AFTER_MS,
} from "@/lib/traffic-constants";
import { finalizeTrafficSegment } from "@/lib/traffic-normalize";
import {
  fetchCityCongestionLevels,
  fetchCityTrafficLinks,
  fetchCityTrafficLive,
  fetchCityTrafficSections,
  fetchCityTrafficShapes,
  fetchHighwayCongestionLevels,
  fetchHighwayTrafficLinks,
  fetchHighwayTrafficLive,
  fetchHighwayTrafficSections,
  fetchHighwayTrafficShapes,
  isTdxConfigured,
} from "@/services/tdx-client";
import type { TrafficCatalog, TrafficDataOrigin, TrafficSegment } from "@/types/domain";

export type { TrafficCatalog };

export type TrafficLoadResult = {
  catalog: TrafficCatalog;
  stats: CongestionStats;
  cache: "hit" | "miss";
  cacheTtlMs: number;
  pollMs: number;
  cacheAgeMs: number;
};

type StoredTraffic = Omit<TrafficLoadResult, "cache" | "cacheAgeMs" | "cacheTtlMs" | "pollMs">;

const resultCache = new Map<string, { at: number; stored: StoredTraffic }>();
const inflight = new Map<string, Promise<TrafficLoadResult>>();
const cityStaticCache = new Map<string, { at: number; bundle: CountyTrafficBundle }>();
let highwayStaticCache: { at: number; bundle: CountyTrafficBundle } | null = null;
let highwayStaticInflight: Promise<CountyTrafficBundle> | null = null;
let activeFetches = 0;
const fetchQueue: Array<() => void> = [];

function scheduleTdx<T>(task: () => Promise<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    const run = () => {
      activeFetches += 1;
      task()
        .then(resolve, reject)
        .finally(() => {
          activeFetches -= 1;
          fetchQueue.shift()?.();
        });
    };
    if (activeFetches < 2) run();
    else fetchQueue.push(run);
  });
}

export async function loadTainanTraffic(force = false): Promise<TrafficCatalog> {
  const result = await loadCityTraffic("Tainan", force);
  return result.catalog;
}

export async function loadCityTraffic(
  city: string,
  force = false,
): Promise<TrafficLoadResult> {
  const cached = resultCache.get(city);
  const age = cached ? Date.now() - cached.at : Number.POSITIVE_INFINITY;
  if (
    cached &&
    trafficCacheDecision(age, TRAFFIC_LIVE_CACHE_MS, force, TRAFFIC_MIN_REFRESH_MS) ===
      "hit"
  ) {
    return decorate(cached.stored, "hit", age);
  }

  const flightKey = city;
  const pending = inflight.get(flightKey);
  if (pending) return pending;

  const promise = fillCityTraffic(city)
    .then((stored) => {
      resultCache.set(city, { at: Date.now(), stored });
      return decorate(stored, "miss", 0);
    })
    .finally(() => {
      inflight.delete(flightKey);
    });
  inflight.set(flightKey, promise);
  return promise;
}

async function fillCityTraffic(city: string): Promise<StoredTraffic> {
  if (city === "YunlinCounty" && fixtureEnabled() && !isTdxConfigured()) {
    return loadYunlinFixture();
  }
  if (!isTdxConfigured()) return fallbackCatalog(city);

  try {
    const [cityBundle, cityLive, highwayBundle, highwayLive] = await Promise.all([
      loadCityStatic(city),
      scheduleTdx(() => fetchCityTrafficLive(city)),
      loadHighwayStatic(),
      scheduleTdx(() => fetchHighwayTrafficLive()),
    ]);
    const built = buildCountyTraffic({
      city,
      origin: "tdx-live",
      cityBundle: { ...cityBundle, live: cityLive },
      highwayBundle: { ...highwayBundle, live: highwayLive },
      bounds: trafficCityBounds(city),
    });
    if (!built.segments.length && !built.stats.sectionsFetched) {
      return fallbackCatalog(city);
    }
    return {
      catalog: toCatalog("tdx-live", built.segments, newestStamp(built.segments, cityLive.updateTime, highwayLive.updateTime)),
      stats: built.stats,
    };
  } catch (error) {
    console.warn(
      "TDX live traffic unavailable",
      error instanceof Error ? error.message : "unknown error",
    );
    const cached = resultCache.get(city);
    if (cached) {
      return {
        catalog: { ...cached.stored.catalog, stale: true },
        stats: cached.stored.stats,
      };
    }
    return fallbackCatalog(city);
  }
}

async function loadCityStatic(city: string): Promise<CountyTrafficBundle> {
  const cached = cityStaticCache.get(city);
  if (cached && Date.now() - cached.at < TRAFFIC_SHAPE_CACHE_MS) return cached.bundle;
  const [sections, shapes, links, levels] = await Promise.all([
    scheduleTdx(() => fetchCityTrafficSections(city)),
    scheduleTdx(() => fetchCityTrafficShapes(city)),
    scheduleTdx(() => fetchCityTrafficLinks(city)),
    scheduleTdx(() => fetchCityCongestionLevels(city)),
  ]);
  const bundle: CountyTrafficBundle = {
    live: { authorityCode: "", items: [] },
    sections,
    shapes,
    links,
    levels,
  };
  cityStaticCache.set(city, { at: Date.now(), bundle });
  return bundle;
}

async function loadHighwayStatic(): Promise<CountyTrafficBundle> {
  if (highwayStaticCache && Date.now() - highwayStaticCache.at < TRAFFIC_SHAPE_CACHE_MS) {
    return highwayStaticCache.bundle;
  }
  if (highwayStaticInflight) return highwayStaticInflight;
  highwayStaticInflight = Promise.all([
    scheduleTdx(() => fetchHighwayTrafficSections()),
    scheduleTdx(() => fetchHighwayTrafficShapes()),
    scheduleTdx(() => fetchHighwayTrafficLinks()),
    scheduleTdx(() => fetchHighwayCongestionLevels()),
  ])
    .then(([sections, shapes, links, levels]) => {
      const bundle: CountyTrafficBundle = {
        live: { authorityCode: "", items: [] },
        sections,
        shapes,
        links,
        levels,
      };
      highwayStaticCache = { at: Date.now(), bundle };
      return bundle;
    })
    .finally(() => {
      highwayStaticInflight = null;
    });
  return highwayStaticInflight;
}

function fixtureEnabled() {
  const value = process.env.TDX_TRAFFIC_FIXTURE?.trim().toLowerCase();
  return value === "1" || value === "true";
}

async function loadYunlinFixture(): Promise<StoredTraffic> {
  const file = path.join(process.cwd(), "fixtures/tdx/yunlin-traffic.json");
  const json = JSON.parse(await readFile(file, "utf8")) as {
    city: Parameters<typeof envelopesFromBundle>[0];
    highway: Parameters<typeof envelopesFromBundle>[0];
  };
  const built = buildCountyTraffic({
    city: "YunlinCounty",
    origin: "tdx-fixture",
    cityBundle: envelopesFromBundle(json.city),
    highwayBundle: envelopesFromBundle(json.highway),
    bounds: trafficCityBounds("YunlinCounty"),
  });
  return {
    catalog: toCatalog("tdx-fixture", built.segments),
    stats: built.stats,
  };
}

function fallbackCatalog(city: string): StoredTraffic {
  if (city === "Tainan" && isDemoDataEnabled()) {
    return { catalog: fromMock(), stats: emptyCongestionStats(city) };
  }
  const fetchedAt = new Date().toISOString();
  return {
    catalog: {
      origin: "unavailable",
      segments: [],
      fetchedAt,
      source: "unavailable",
      updatedAt: fetchedAt,
      stale: false,
    },
    stats: emptyCongestionStats(city),
  };
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
    source: "mock",
    updatedAt: now,
    stale: false,
  };
}

function toCatalog(
  origin: TrafficDataOrigin,
  segments: TrafficSegment[],
  sourceUpdatedAt?: string,
): TrafficCatalog {
  const fetchedAt = new Date().toISOString();
  const updatedAt = sourceUpdatedAt || newestStamp(segments) || fetchedAt;
  const stale =
    origin === "tdx-live" &&
    Date.now() - new Date(updatedAt).getTime() > TRAFFIC_STALE_AFTER_MS;
  return {
    origin,
    segments,
    fetchedAt,
    source: origin === "tdx-live" ? "tdx" : origin === "unavailable" ? "unavailable" : "mock",
    updatedAt,
    stale,
  };
}

function newestStamp(segments: TrafficSegment[], ...extra: (string | undefined)[]) {
  const times = [
    ...segments.map((segment) => segment.updatedAt),
    ...extra,
  ]
    .filter((value): value is string => Boolean(value))
    .map((value) => new Date(value).getTime())
    .filter(Number.isFinite);
  if (!times.length) return undefined;
  return new Date(Math.max(...times)).toISOString();
}

function decorate(
  stored: StoredTraffic,
  cache: "hit" | "miss",
  cacheAgeMs: number,
): TrafficLoadResult {
  return {
    ...stored,
    cache,
    cacheAgeMs,
    cacheTtlMs: TRAFFIC_LIVE_CACHE_MS,
    pollMs: TRAFFIC_LIVE_CACHE_MS,
  };
}
