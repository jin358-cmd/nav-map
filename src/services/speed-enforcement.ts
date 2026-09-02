import "server-only";
import {
  SPEED_ENFORCEMENT_CACHE_MS,
  SPEED_ENFORCEMENT_MAX_RADIUS_METERS,
  SPEED_ENFORCEMENT_MIN_RADIUS_METERS,
  TGOS_SPEED_THEME_ID,
} from "@/lib/speed-enforcement-constants";
import type {
  SpeedEnforcementCatalog,
  SpeedEnforcementPoint,
} from "@/types/domain";

const TGOS_BUFFER_ENDPOINT =
  "https://data.tgos.tw/MOIDataThemeAPIMgr/Theme/Buffer";

type TgosSpeedFeature = {
  geometry?: {
    type?: string;
    coordinates?: unknown[];
  };
  properties?: Record<string, unknown>;
};

type TgosSpeedResponse = {
  responseMessage?: string;
  responseCount?: number;
  type?: string;
  features?: TgosSpeedFeature[];
};

type CacheEntry = {
  catalog: SpeedEnforcementCatalog;
  cachedAt: number;
};

export class SpeedEnforcementConfigurationError extends Error {}

const catalogCache = new Map<string, CacheEntry>();

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function finiteNumber(value: unknown) {
  const number = typeof value === "number" ? value : Number(value);
  return Number.isFinite(number) ? number : undefined;
}

function normalizeFeature(
  feature: TgosSpeedFeature,
  index: number,
): SpeedEnforcementPoint | null {
  const properties = feature.properties ?? {};
  const coordinates = feature.geometry?.coordinates;
  const lng = finiteNumber(coordinates?.[0] ?? properties.lng);
  const lat = finiteNumber(coordinates?.[1] ?? properties.lat);
  if (
    lng === undefined ||
    lat === undefined ||
    lng < 118 ||
    lng > 123 ||
    lat < 20 ||
    lat > 27
  ) {
    return null;
  }

  const address = text(properties.address) || "測速執法設置點";
  const speedLimit = finiteNumber(properties.limit);
  return {
    id: `tgos-speed-${lng}-${lat}-${index}`,
    city: text(properties.countyname),
    district: text(properties.townname),
    address,
    department: text(properties.deptnm),
    branch: text(properties.branchnm),
    direction: text(properties.direct),
    speedLimit:
      speedLimit !== undefined && speedLimit > 0
        ? Math.round(speedLimit)
        : undefined,
    note: text(properties.note) || undefined,
    location: { lng, lat },
    dataOrigin: "tgos",
  };
}

function cacheKey(lng: number, lat: number, radiusMeters: number) {
  return `${lng.toFixed(4)},${lat.toFixed(4)},${radiusMeters}`;
}

function trimCache() {
  if (catalogCache.size < 12) return;
  const oldest = [...catalogCache.entries()].sort(
    ([, left], [, right]) => left.cachedAt - right.cachedAt,
  )[0]?.[0];
  if (oldest) catalogCache.delete(oldest);
}

export async function loadNearbySpeedEnforcement({
  lng,
  lat,
  radiusMeters,
  force = false,
}: {
  lng: number;
  lat: number;
  radiusMeters: number;
  force?: boolean;
}): Promise<SpeedEnforcementCatalog> {
  const apiKey =
    process.env.TGOS_THEME_API_KEY?.trim() ||
    process.env.TGOS_API_KEY?.trim();
  if (!apiKey) {
    throw new SpeedEnforcementConfigurationError(
      "TGOS 測速圖層尚未設定 API 金鑰",
    );
  }

  const radius = Math.min(
    SPEED_ENFORCEMENT_MAX_RADIUS_METERS,
    Math.max(SPEED_ENFORCEMENT_MIN_RADIUS_METERS, Math.round(radiusMeters)),
  );
  const key = cacheKey(lng, lat, radius);
  const cached = catalogCache.get(key);
  if (
    !force &&
    cached &&
    Date.now() - cached.cachedAt < SPEED_ENFORCEMENT_CACHE_MS
  ) {
    return cached.catalog;
  }

  const url = new URL(TGOS_BUFFER_ENDPOINT);
  url.searchParams.set("Apikey", apiKey);
  url.searchParams.set("Theme_Id", TGOS_SPEED_THEME_ID);
  url.searchParams.set("Lng", String(lng));
  url.searchParams.set("Lat", String(lat));
  url.searchParams.set("Radius", String(radius));

  const response = await fetch(url, {
    headers: { Accept: "application/json" },
    cache: "no-store",
    signal: AbortSignal.timeout(12_000),
  });
  if (!response.ok) {
    throw new Error(`TGOS speed enforcement request failed (${response.status})`);
  }

  const payload = (await response.json()) as TgosSpeedResponse;
  if (!Array.isArray(payload.features)) {
    throw new Error(
      payload.responseMessage || "TGOS speed enforcement response invalid",
    );
  }

  const catalog: SpeedEnforcementCatalog = {
    origin: "tgos",
    points: payload.features
      .map(normalizeFeature)
      .filter((point): point is SpeedEnforcementPoint => point !== null),
    fetchedAt: new Date().toISOString(),
  };
  trimCache();
  catalogCache.set(key, { catalog, cachedAt: Date.now() });
  return catalog;
}
