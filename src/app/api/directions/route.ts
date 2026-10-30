import { maneuverFromOsrm, stepsFromOsrm, type OsrmStep } from "@/lib/osrm-maneuver";
import {
  buildOsrmRouteUrl,
  OSRM_ROUTE_TIMEOUT_MS,
  resolveOsrmBaseUrl,
} from "@/lib/osrm-route";
import type { TravelMode } from "@/types/domain";

export const dynamic = "force-dynamic";

type OsrmPayload = {
  code?: string;
  message?: string;
  routes?: Array<{
    distance: number;
    duration: number;
    geometry?: { coordinates?: [number, number][] };
    legs?: Array<{ steps?: OsrmStep[] }>;
  }>;
};

export async function GET(request: Request) {
  const url = new URL(request.url);
  const coordinate = (name: string) => {
    const raw = url.searchParams.get(name);
    if (raw == null || raw.trim() === "") return Number.NaN;
    return Number(raw);
  };
  const fromLng = coordinate("fromLng");
  const fromLat = coordinate("fromLat");
  const toLng = coordinate("toLng");
  const toLat = coordinate("toLat");
  const label = url.searchParams.get("label")?.trim() || "目的地";
  const travelMode: TravelMode =
    url.searchParams.get("mode") === "motorcycle" ? "motorcycle" : "car";

  if (
    ![fromLng, fromLat, toLng, toLat].every((value) => Number.isFinite(value))
  ) {
    return Response.json({ error: "起訖座標不完整" }, { status: 400 });
  }

  const resolved = resolveOsrmBaseUrl(travelMode);
  if (!resolved.ok) {
    return Response.json(
      { error: resolved.error, code: resolved.code, travelMode },
      { status: resolved.status },
    );
  }

  return routeFromOsrm(
    resolved.baseUrl,
    fromLng,
    fromLat,
    toLng,
    toLat,
    label,
    travelMode,
  );
}

function planPayload(
  coordinates: [number, number][],
  distanceMeters: number,
  durationSeconds: number,
  rawSteps: OsrmStep[],
  label: string,
  toLng: number,
  toLat: number,
  travelMode: TravelMode,
) {
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

async function fetchOsrmRoute(
  endpoint: URL,
): Promise<OsrmPayload | "timeout" | "invalid"> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), OSRM_ROUTE_TIMEOUT_MS);
  try {
    const response = await fetch(endpoint, {
      headers: { Accept: "application/json" },
      cache: "no-store",
      signal: controller.signal,
    });
    if (!response.ok) {
      return response.status >= 500 ? "timeout" : "invalid";
    }
    return (await response.json()) as OsrmPayload;
  } catch (error) {
    const aborted =
      (error instanceof Error && error.name === "AbortError") ||
      (typeof error === "object" &&
        error !== null &&
        "name" in error &&
        (error as { name?: string }).name === "AbortError");
    return aborted ? "timeout" : "timeout";
  } finally {
    clearTimeout(timer);
  }
}

async function routeFromOsrm(
  baseUrl: string,
  fromLng: number,
  fromLat: number,
  toLng: number,
  toLat: number,
  label: string,
  travelMode: TravelMode,
) {
  const endpoint = buildOsrmRouteUrl(baseUrl, fromLng, fromLat, toLng, toLat);

  try {
    const data = await fetchOsrmRoute(endpoint);
    if (data === "timeout") {
      return Response.json(
        { error: "路線規劃逾時，請再試一次", travelMode },
        { status: 504 },
      );
    }
    if (data === "invalid") {
      return Response.json(
        {
          error:
            travelMode === "motorcycle" ? "找不到可騎乘路線" : "找不到可開車路線",
          travelMode,
        },
        { status: 404 },
      );
    }
    const route = data.routes?.[0];
    const coordinates = route?.geometry?.coordinates ?? [];
    if (data.code !== "Ok" || coordinates.length < 2) {
      return Response.json(
        {
          error:
            travelMode === "motorcycle" ? "找不到可騎乘路線" : "找不到可開車路線",
          travelMode,
        },
        { status: 404 },
      );
    }

    const rawSteps = (route?.legs ?? []).flatMap((leg) => leg.steps ?? []);
    const distanceMeters = route?.distance ?? 0;
    const durationSeconds = route?.duration ?? 0;

    return Response.json(
      planPayload(
        coordinates,
        distanceMeters,
        durationSeconds,
        rawSteps,
        label,
        toLng,
        toLat,
        travelMode,
      ),
    );
  } catch {
    return Response.json({ error: "路線規劃失敗", travelMode }, { status: 502 });
  }
}
