import { maneuverFromOsrm, stepsFromOsrm, type OsrmStep } from "@/lib/osrm-maneuver";
import { fetchValhallaMotorcycleRoute } from "@/lib/valhalla-route";

const OSRM_CAR = "https://router.project-osrm.org/route/v1/driving";
const OSRM_TIMEOUT_MS = 8_000;

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
  const fromLng = Number(url.searchParams.get("fromLng"));
  const fromLat = Number(url.searchParams.get("fromLat"));
  const toLng = Number(url.searchParams.get("toLng"));
  const toLat = Number(url.searchParams.get("toLat"));
  const label = url.searchParams.get("label")?.trim() || "目的地";
  const travelMode =
    url.searchParams.get("mode") === "motorcycle" ? "motorcycle" : "car";

  if (
    ![fromLng, fromLat, toLng, toLat].every((value) => Number.isFinite(value))
  ) {
    return Response.json({ error: "起訖座標不完整" }, { status: 400 });
  }

  if (travelMode === "motorcycle") {
    return routeMotorcycle(fromLng, fromLat, toLng, toLat, label);
  }

  return routeFromOsrmLike(
    OSRM_CAR,
    fromLng,
    fromLat,
    toLng,
    toLat,
    label,
    "car",
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
  travelMode: "car" | "motorcycle",
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

async function routeMotorcycle(
  fromLng: number,
  fromLat: number,
  toLng: number,
  toLat: number,
  label: string,
) {
  try {
    const routed = await fetchValhallaMotorcycleRoute(
      fromLng,
      fromLat,
      toLng,
      toLat,
    );
    if (!routed) {
      return Response.json(
        { error: "找不到可騎乘路線", travelMode: "motorcycle" },
        { status: 404 },
      );
    }
    return Response.json(
      planPayload(
        routed.coordinates,
        routed.distanceMeters,
        routed.durationSeconds,
        routed.steps,
        label,
        toLng,
        toLat,
        "motorcycle",
      ),
    );
  } catch {
    return Response.json(
      { error: "機車路線規劃失敗，請再試一次", travelMode: "motorcycle" },
      { status: 502 },
    );
  }
}

async function fetchOsrmRoute(endpoint: URL): Promise<OsrmPayload | "timeout" | "invalid"> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), OSRM_TIMEOUT_MS);
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

async function routeFromOsrmLike(
  baseUrl: string,
  fromLng: number,
  fromLat: number,
  toLng: number,
  toLat: number,
  label: string,
  travelMode: "car" | "motorcycle",
) {
  const path = `${fromLng},${fromLat};${toLng},${toLat}`;
  const endpoint = new URL(
    baseUrl.includes("{path}")
      ? baseUrl.replace("{path}", path)
      : `${baseUrl.replace(/\/$/, "")}/${path}`,
  );
  endpoint.searchParams.set("overview", "full");
  endpoint.searchParams.set("geometries", "geojson");
  endpoint.searchParams.set("steps", "true");
  endpoint.searchParams.set("alternatives", "false");

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
          error: travelMode === "motorcycle" ? "找不到可騎乘路線" : "找不到可開車路線",
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
          error: travelMode === "motorcycle" ? "找不到可騎乘路線" : "找不到可開車路線",
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
