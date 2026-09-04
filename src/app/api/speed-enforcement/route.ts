import { loadNearbySpeedEnforcement } from "@/services/speed-enforcement";

function readNumber(value: string | null) {
  if (!value) return undefined;
  const number = Number(value);
  return Number.isFinite(number) ? number : undefined;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const lng = readNumber(url.searchParams.get("lng"));
  const lat = readNumber(url.searchParams.get("lat"));
  const radiusMeters = readNumber(url.searchParams.get("radius")) ?? 8_000;
  const force = url.searchParams.get("fresh") === "1";

  if (
    lng === undefined ||
    lat === undefined ||
    lng < 118 ||
    lng > 123 ||
    lat < 20 ||
    lat > 27 ||
    radiusMeters < 1_000 ||
    radiusMeters > 10_000
  ) {
    return Response.json(
      { error: "請提供臺灣範圍內的經緯度與 1–10 公里半徑" },
      { status: 400 },
    );
  }

  console.info("speed-enforcement request", {
    lng,
    lat,
    radiusMeters,
    fresh: force,
  });

  try {
    const catalog = await loadNearbySpeedEnforcement({
      lng,
      lat,
      radiusMeters,
      force,
    });
    return Response.json(catalog, {
      headers: {
        "Cache-Control": force
          ? "no-store"
          : "public, s-maxage=300, stale-while-revalidate=600",
      },
    });
  } catch (error) {
    console.warn(
      "TGOS speed enforcement API unavailable",
      error instanceof Error ? error.message : "unknown error",
    );
    return Response.json(
      { error: "測速執法公開資料暫時無法載入" },
      { status: 502 },
    );
  }
}
