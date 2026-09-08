import { maneuverFromOsrm, stepsFromOsrm, type OsrmStep } from "@/lib/osrm-maneuver";

const OSRM_CAR = "https://router.project-osrm.org/route/v1/driving";
const OSRM_TIMEOUT_MS = 4_500;

type OsrmPayload = {
  code?: string;
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
    const motorcycleUrl = process.env.MOTORCYCLE_ROUTING_URL?.trim();
    return routeFromOsrmLike(
      motorcycleUrl || OSRM_CAR,
      fromLng,
      fromLat,
      toLng,
      toLat,
      label,
      "motorcycle",
    );
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

async function fetchOsrmRoute(endpoint: URL): Promise<OsrmPayload | null> {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), OSRM_TIMEOUT_MS);
    try {
      const response = await fetch(endpoint, {
        headers: { Accept: "application/json" },
        cache: "no-store",
        signal: controller.signal,
      });
      if (!response.ok) {
        if (attempt === 0) continue;
        return null;
      }
      return (await response.json()) as OsrmPayload;
    } catch {
      if (attempt === 0) continue;
      return null;
    } finally {
      clearTimeout(timer);
    }
  }
  return null;
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
  if (travelMode === "motorcycle") {
    endpoint.searchParams.set("exclude", "motorway");
  }

  try {
    const data = await fetchOsrmRoute(endpoint);
    if (!data) {
      return Response.json(
        { error: "路線規劃逾時，請再試一次", travelMode },
        { status: 504 },
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

    return Response.json({
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
    });
  } catch {
    return Response.json({ error: "路線規劃失敗", travelMode }, { status: 502 });
  }
}
