import "server-only";
import publicSpeedEnforcementSnapshot from "@/data/speed-enforcement-public.json";
import {
  SPEED_ENFORCEMENT_CACHE_MS,
  SPEED_ENFORCEMENT_MAX_RADIUS_METERS,
  SPEED_ENFORCEMENT_MIN_RADIUS_METERS,
  SPEED_ENFORCEMENT_PUBLIC_CACHE_MS,
  TGOS_SPEED_THEME_ID,
} from "@/lib/speed-enforcement-constants";
import type {
  SpeedEnforcementCatalog,
  SpeedEnforcementPoint,
} from "@/types/domain";

const TGOS_BUFFER_ENDPOINT =
  "https://data.tgos.tw/MOIDataThemeAPIMgr/Theme/Buffer";
const PUBLIC_DATASET_ENDPOINT =
  "https://opdadm.moi.gov.tw/api/v1/no-auth/resource/api/dataset/EA5E6FCD-B82D-43B7-A5CF-E9893253187E/resource/8F8822DA-2D76-45B4-8945-71F5FFD0DE85/download";

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

type PublicSpeedEnforcementSnapshot = {
  source: string;
  downloadedAt: string;
  csv: string;
};

const catalogCache = new Map<string, CacheEntry>();
const bundledPublicSnapshot =
  publicSpeedEnforcementSnapshot as PublicSpeedEnforcementSnapshot;
let publicCatalogCache = normalizePublicCsv(bundledPublicSnapshot.csv);
let publicCatalogFetchedAt =
  Date.parse(bundledPublicSnapshot.downloadedAt) || Date.now();
let publicCatalogAttemptedAt = publicCatalogFetchedAt;

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function finiteNumber(value: unknown) {
  const number = typeof value === "number" ? value : Number(value);
  return Number.isFinite(number) ? number : undefined;
}

function distanceMeters(
  left: { lng: number; lat: number },
  right: { lng: number; lat: number },
) {
  const radius = 6_371_000;
  const toRadians = (value: number) => (value * Math.PI) / 180;
  const dLat = toRadians(right.lat - left.lat);
  const dLng = toRadians(right.lng - left.lng);
  const lat1 = toRadians(left.lat);
  const lat2 = toRadians(right.lat);
  const value =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return radius * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value));
}

function parseCsv(input: string) {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;

  for (let index = 0; index < input.length; index += 1) {
    const character = input[index];
    if (quoted) {
      if (character === '"' && input[index + 1] === '"') {
        field += '"';
        index += 1;
      } else if (character === '"') {
        quoted = false;
      } else {
        field += character;
      }
      continue;
    }

    if (character === '"') {
      quoted = true;
    } else if (character === ",") {
      row.push(field);
      field = "";
    } else if (character === "\n") {
      row.push(field.replace(/\r$/, ""));
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += character;
    }
  }

  if (field || row.length) {
    row.push(field.replace(/\r$/, ""));
    rows.push(row);
  }
  return rows;
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

function normalizePublicCsv(input: string) {
  const rows = parseCsv(input);
  const headers = rows[0]?.map((header) => header.replace(/^\uFEFF/, ""));
  if (!headers?.length) throw new Error("公開測速資料缺少欄位");
  const column = new Map(headers.map((header, index) => [header, index]));
  const required = ["CityName", "RegionName", "Address", "Longitude", "Latitude"];
  if (required.some((header) => !column.has(header))) {
    throw new Error("公開測速資料欄位格式不符");
  }

  const value = (row: string[], header: string) =>
    row[column.get(header) ?? -1]?.trim() ?? "";
  return rows.slice(1).flatMap((row, index) => {
    if (value(row, "CityName") === "設置縣市") return [];
    const lng = finiteNumber(value(row, "Longitude"));
    const lat = finiteNumber(value(row, "Latitude"));
    if (
      lng === undefined ||
      lat === undefined ||
      lng < 118 ||
      lng > 123 ||
      lat < 20 ||
      lat > 27
    ) {
      return [];
    }
    const speedLimit = finiteNumber(value(row, "limit"));
    return [
      {
        id: `open-speed-${lng}-${lat}-${index}`,
        city: value(row, "CityName"),
        district: value(row, "RegionName"),
        address: value(row, "Address") || "測速執法設置點",
        department: value(row, "DeptNm"),
        branch: value(row, "BranchNm"),
        direction: value(row, "direct"),
        speedLimit:
          speedLimit !== undefined && speedLimit > 0
            ? Math.round(speedLimit)
            : undefined,
        location: { lng, lat },
        dataOrigin: "open-data" as const,
      },
    ];
  });
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

  const apiKey = process.env.TGOS_THEME_API_KEY?.trim();
  if (apiKey) {
    try {
      const catalog = await loadFromTgos({ lng, lat, radius, apiKey });
      trimCache();
      catalogCache.set(key, { catalog, cachedAt: Date.now() });
      return catalog;
    } catch (error) {
      console.warn(
        "TGOS theme API fallback to public speed dataset",
        error instanceof Error ? error.message : "unknown error",
      );
    }
  }

  const catalog = await loadFromPublicDataset({
    lng,
    lat,
    radius,
    force,
  });
  trimCache();
  catalogCache.set(key, { catalog, cachedAt: Date.now() });
  return catalog;
}

async function loadFromTgos({
  lng,
  lat,
  radius,
  apiKey,
}: {
  lng: number;
  lat: number;
  radius: number;
  apiKey: string;
}): Promise<SpeedEnforcementCatalog> {

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
  return catalog;
}

async function loadFromPublicDataset({
  lng,
  lat,
  radius,
  force,
}: {
  lng: number;
  lat: number;
  radius: number;
  force: boolean;
}): Promise<SpeedEnforcementCatalog> {
  if (
    force ||
    Date.now() - publicCatalogAttemptedAt >= SPEED_ENFORCEMENT_PUBLIC_CACHE_MS
  ) {
    publicCatalogAttemptedAt = Date.now();
    try {
      const response = await fetch(PUBLIC_DATASET_ENDPOINT, {
        headers: { Accept: "text/csv" },
        cache: "force-cache",
        next: {
          revalidate: Math.floor(SPEED_ENFORCEMENT_PUBLIC_CACHE_MS / 1_000),
        },
        signal: AbortSignal.timeout(4_000),
      });
      if (!response.ok) {
        throw new Error(
          `Public speed dataset request failed (${response.status})`,
        );
      }
      publicCatalogCache = normalizePublicCsv(await response.text());
      publicCatalogFetchedAt = Date.now();
    } catch (error) {
      console.warn(
        "Public speed dataset refresh kept bundled snapshot",
        error instanceof Error ? error.message : "unknown error",
      );
    }
  }

  const center = { lng, lat };
  return {
    origin: "open-data",
    points: publicCatalogCache.filter(
      (point) => distanceMeters(center, point.location) <= radius,
    ),
    fetchedAt: new Date(publicCatalogFetchedAt).toISOString(),
  };
}
