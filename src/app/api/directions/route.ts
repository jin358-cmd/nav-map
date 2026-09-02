import { maneuverFromOsrm } from "@/lib/osrm-maneuver";

const OSRM = "https://router.project-osrm.org/route/v1/driving";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const fromLng = Number(url.searchParams.get("fromLng"));
  const fromLat = Number(url.searchParams.get("fromLat"));
  const toLng = Number(url.searchParams.get("toLng"));
  const toLat = Number(url.searchParams.get("toLat"));
  const label = url.searchParams.get("label")?.trim() || "目的地";

  if (
    ![fromLng, fromLat, toLng, toLat].every((value) => Number.isFinite(value))
  ) {
    return Response.json({ error: "起訖座標不完整" }, { status: 400 });
  }

  const path = `${fromLng},${fromLat};${toLng},${toLat}`;
  const osrm = new URL(`${OSRM}/${path}`);
  osrm.searchParams.set("overview", "full");
  osrm.searchParams.set("geometries", "geojson");
  osrm.searchParams.set("steps", "true");
  osrm.searchParams.set("alternatives", "false");

  try {
    const response = await fetch(osrm, {
      headers: { Accept: "application/json" },
      next: { revalidate: 120 },
    });
    if (!response.ok) {
      return Response.json({ error: "路線規劃服務忙碌" }, { status: 502 });
    }
    const data = (await response.json()) as {
      code?: string;
      routes?: Array<{
        distance: number;
        duration: number;
        geometry?: { coordinates?: [number, number][] };
        legs?: Array<{ steps?: Array<{ name?: string; distance?: number; maneuver?: { type?: string; modifier?: string } }> }>;
      }>;
    };
    const route = data.routes?.[0];
    const coordinates = route?.geometry?.coordinates ?? [];
    if (data.code !== "Ok" || coordinates.length < 2) {
      return Response.json({ error: "找不到可開車路線" }, { status: 404 });
    }

    const steps = route?.legs?.[0]?.steps ?? [];
    const distanceMeters = route?.distance ?? 0;
    const durationSeconds = route?.duration ?? 0;

    return Response.json({
      coordinates,
      distanceMeters,
      durationSeconds,
      destination: {
        label,
        address: label,
        location: { lng: toLng, lat: toLat },
      },
      maneuver: maneuverFromOsrm(steps, label, distanceMeters, durationSeconds),
    });
  } catch {
    return Response.json({ error: "路線規劃失敗" }, { status: 502 });
  }
}
