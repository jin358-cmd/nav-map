import { maneuverFromOsrm, stepsFromOsrm, type OsrmStep } from "@/lib/osrm-maneuver";
import {
  buildOsrmRouteUrl,
  OSRM_ROUTE_TIMEOUT_MS,
  resolveOsrmBaseUrl,
} from "@/lib/osrm-route";
import type { TravelMode } from "@/types/domain";

export const dynamic = "force-dynamic";

type OsrmRoute = {
  distance?: number;
  duration?: number;
  geometry?: { coordinates?: [number, number][] };
  legs?: Array<{ steps?: OsrmStep[] }>;
};

type OsrmPayload = {
  code?: string;
  routes?: OsrmRoute[];
};

function coordinate(url: URL, name: string) {
  const raw = url.searchParams.get(name);
  if (raw == null || raw.trim() === "") return Number.NaN;
  return Number(raw);
}

function planFromOsrm(
  route: OsrmRoute,
  label: string,
  toLng: number,
  toLat: number,
  travelMode: TravelMode,
) {
  const coordinates = route.geometry?.coordinates ?? [];
  const rawSteps = (route.legs ?? []).flatMap((leg) => leg.steps ?? []);
  const distanceMeters = route.distance ?? 0;
  const durationSeconds = route.duration ?? 0;
  return {
    coordinates,
    distanceMeters,
    durationSeconds,
    travelMode,
    destination: {
      label,
      address: label,
      location: { lng: toLng, lat: toLat },
    },
    maneuver: maneuverFromOsrm(rawSteps, label, distanceMeters, durationSeconds),
    steps: stepsFromOsrm(rawSteps, label),
  };
}

async function fetchOsrm(endpoint: URL): Promise<OsrmPayload | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), OSRM_ROUTE_TIMEOUT_MS);
  try {
    const response = await fetch(endpoint, {
      headers: { Accept: "application/json" },
      cache: "no-store",
      signal: controller.signal,
    });
    if (!response.ok) return null;
    return (await response.json()) as OsrmPayload;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const fromLng = coordinate(url, "fromLng");
  const fromLat = coordinate(url, "fromLat");
  const toLng = coordinate(url, "toLng");
  const toLat = coordinate(url, "toLat");
  const viaLng = coordinate(url, "viaLng");
  const viaLat = coordinate(url, "viaLat");
  const label = url.searchParams.get("label")?.trim() || "目的地";
  const travelMode: TravelMode =
    url.searchParams.get("mode") === "motorcycle" ? "motorcycle" : "car";
  const wantsAlternatives = url.searchParams.get("alternatives") === "1";
  const hasVia = Number.isFinite(viaLng) && Number.isFinite(viaLat);

  if (![fromLng, fromLat, toLng, toLat].every((value) => Number.isFinite(value))) {
    return Response.json({ error: "起訖座標不完整", routes: [] }, { status: 400 });
  }

  const resolved = resolveOsrmBaseUrl(travelMode);
  if (!resolved.ok) {
    return Response.json(
      { error: resolved.error, code: resolved.code, travelMode, routes: [] },
      { status: resolved.status },
    );
  }

  const endpoint = buildOsrmRouteUrl(
    resolved.baseUrl,
    fromLng,
    fromLat,
    toLng,
    toLat,
    hasVia
      ? { alternatives: false, via: [{ lng: viaLng, lat: viaLat }], viaRadiusMeters: 30 }
      : { alternatives: wantsAlternatives },
  );
  const data = await fetchOsrm(endpoint);
  const routes = (data?.code === "Ok" ? data.routes ?? [] : [])
    .filter((route) => (route.geometry?.coordinates?.length ?? 0) >= 2)
    .slice(0, 3)
    .map((route) => planFromOsrm(route, label, toLng, toLat, travelMode));

  if (routes.length === 0) {
    return Response.json(
      {
        error: travelMode === "motorcycle" ? "找不到可騎乘路線" : "找不到可開車路線",
        travelMode,
        routes: [],
      },
      { status: 404 },
    );
  }
  return Response.json({ routes, travelMode });
}
