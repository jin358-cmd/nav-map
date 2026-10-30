import type { TravelMode } from "@/types/domain";

export const PUBLIC_OSRM_CAR_URL =
  "https://router.project-osrm.org/route/v1/driving";

export const OSRM_ROUTE_TIMEOUT_MS = 8_000;

export type OsrmEnv = {
  OSRM_CAR_URL?: string;
  OSRM_MOTORCYCLE_URL?: string;
};

export type OsrmBaseResolution =
  | { ok: true; baseUrl: string }
  | { ok: false; status: number; code: string; error: string };

const MOTORCYCLE_UNCONFIGURED =
  "機車路線尚未設定（NOT CONFIGURED）。伺服器未設定 OSRM_MOTORCYCLE_URL。";

export function isHttpUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

export function isPublicOsrmDemo(value: string) {
  return /project-osrm\.org/i.test(value);
}

export function resolveOsrmBaseUrl(
  mode: TravelMode,
  env: OsrmEnv = {
    OSRM_CAR_URL: process.env.OSRM_CAR_URL,
    OSRM_MOTORCYCLE_URL: process.env.OSRM_MOTORCYCLE_URL,
  },
): OsrmBaseResolution {
  if (mode === "motorcycle") {
    const raw = env.OSRM_MOTORCYCLE_URL?.trim() ?? "";
    if (!raw || !isHttpUrl(raw) || isPublicOsrmDemo(raw)) {
      return {
        ok: false,
        status: 501,
        code: "NOT_CONFIGURED",
        error: MOTORCYCLE_UNCONFIGURED,
      };
    }
    return { ok: true, baseUrl: raw };
  }

  const raw = env.OSRM_CAR_URL?.trim() ?? "";
  if (!raw) return { ok: true, baseUrl: PUBLIC_OSRM_CAR_URL };
  if (!isHttpUrl(raw)) {
    return {
      ok: false,
      status: 500,
      code: "BAD_OSRM_URL",
      error: "OSRM_CAR_URL 不是有效的 http(s) 網址。",
    };
  }
  return { ok: true, baseUrl: raw };
}

export type OsrmRouteRequest = {
  alternatives?: boolean;
  via?: { lng: number; lat: number }[];
  viaRadiusMeters?: number;
};

export function buildOsrmRouteUrl(
  baseUrl: string,
  fromLng: number,
  fromLat: number,
  toLng: number,
  toLat: number,
  request: OsrmRouteRequest = {},
) {
  const via = request.via ?? [];
  const path = [
    `${fromLng},${fromLat}`,
    ...via.map((point) => `${point.lng},${point.lat}`),
    `${toLng},${toLat}`,
  ].join(";");
  const endpoint = new URL(
    baseUrl.includes("{path}")
      ? baseUrl.replace("{path}", path)
      : `${baseUrl.replace(/\/$/, "")}/${path}`,
  );
  endpoint.searchParams.set("overview", "full");
  endpoint.searchParams.set("geometries", "geojson");
  endpoint.searchParams.set("steps", "true");
  endpoint.searchParams.set("alternatives", request.alternatives ? "true" : "false");
  if (via.length > 0) {
    const radius = String(request.viaRadiusMeters ?? 30);
    endpoint.searchParams.set(
      "radiuses",
      ["unlimited", ...via.map(() => radius), "unlimited"].join(";"),
    );
  }
  return endpoint;
}
