import { maneuverFromOsrm, stepsFromOsrm, type OsrmStep } from "@/lib/osrm-maneuver";

const OSRM_CAR = "https://router.project-osrm.org/route/v1/driving";

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
    if (!motorcycleUrl) {
      return Response.json(
        {
          error: "機車路線尚未設定",
          code: "NOT_CONFIGURED",
          provider: "NOT CONFIGURED",
          travelMode,
        },
        { status: 501 },
      );
    }
    return routeFromOsrmLike(
      motorcycleUrl,
      fromLng,
      fromLat,
      toLng,
      toLat,
      label,
      travelMode,
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
    baseUrl.includes("{path}") ? baseUrl.replace("{path}", path) : `${baseUrl.replace(/\/$/, "")}/${path}`,
  );
  endpoint.searchParams.set("overview", "full");
  endpoint.searchParams.set("geometries", "geojson");
  endpoint.searchParams.set("steps", "true");
  endpoint.searchParams.set("alternatives", "false");

  try {
    const response = await fetch(endpoint, {
      headers: { Accept: "application/json" },
      next: { revalidate: 120 },
    });
    if (!response.ok) {
      return Response.json({ error: "路線規劃服務忙碌", travelMode }, { status: 502 });
    }
    const data = (await response.json()) as {
      code?: string;
      routes?: Array<{
        distance: number;
        duration: number;
        geometry?: { coordinates?: [number, number][] };
        legs?: Array<{ steps?: OsrmStep[] }>;
      }>;
    };
    const route = data.routes?.[0];
    const coordinates = route?.geometry?.coordinates ?? [];
    if (data.code !== "Ok" || coordinates.length < 2) {
      return Response.json(
        { error: travelMode === "motorcycle" ? "找不到可騎乘路線" : "找不到可開車路線", travelMode },
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
