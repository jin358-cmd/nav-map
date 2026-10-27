import "server-only";
import {
  buildCatalog,
  degradeTdxStatus,
  structuralCatalog,
  tdxFetchPlan,
  tdxPayloadToRaw,
} from "@/lib/roadwork/engine.mjs";
import type { RoadworkCatalogResponse, RoadworkEvent } from "@/lib/roadwork/public";
import { isTdxConfigured } from "@/services/tdx-client";
import { fetchTdxRoadEventPayloads } from "@/services/tdx-road-events";

const CACHE_MS = 5 * 60 * 1000;

type CacheEntry = {
  expiresAt: number;
  body: RoadworkCatalogResponse;
};

let liveCache: CacheEntry | null = null;

function publish(
  catalog: ReturnType<typeof buildCatalog>,
  origin: RoadworkCatalogResponse["origin"],
  degradedReason: RoadworkCatalogResponse["degradedReason"],
  fetchedAt: string,
  previewLabel: string | null,
): RoadworkCatalogResponse {
  const notices = catalog.notices.map((event) => ({
    ...(event as RoadworkEvent),
    geometry: null,
    map_visible: false,
    voice_eligible: false,
  }));
  const mapEvents = catalog.mapEvents.filter(
    (event) => event.map_visible && event.geometry && event.geometry_confidence === "verified",
  ) as RoadworkEvent[];
  return {
    origin,
    degradedReason,
    fetchedAt,
    previewLabel,
    mapEvents,
    notices,
    counts: {
      ...catalog.counts,
      mapVisible: mapEvents.length,
      notices: notices.length,
    },
    closureAvoidanceEnabled: false,
  };
}

export function structuralRoadworkCatalog(now = new Date()): RoadworkCatalogResponse {
  const fetchedAt = now.toISOString();
  return publish(
    structuralCatalog(fetchedAt),
    "structural-fixture",
    null,
    fetchedAt,
    "結構測試公告，非官方、非即時。沒有座標的公告不會畫在地圖上。",
  );
}

export async function loadRoadworkCatalog(now = new Date()): Promise<RoadworkCatalogResponse> {
  const fetchedAt = now.toISOString();
  const plan = tdxFetchPlan(isTdxConfigured());
  if (!plan.fetch) {
    return publish(buildCatalog([], fetchedAt), "degraded", "unconfigured", fetchedAt, null);
  }

  if (liveCache && liveCache.expiresAt > Date.now()) return liveCache.body;

  try {
    const payloads = await fetchTdxRoadEventPayloads();
    if (!payloads.ok) {
      const body = publish(
        buildCatalog([], fetchedAt),
        "degraded",
        degradeTdxStatus(payloads.status, payloads.timedOut),
        fetchedAt,
        null,
      );
      return body;
    }
    const raw = payloads.bodies.flatMap((body) => tdxPayloadToRaw(body));
    const catalog = buildCatalog(raw, fetchedAt);
    const origin = catalog.events.length === 0 ? "empty" : "tdx";
    const body = publish(
      catalog,
      origin,
      catalog.events.length === 0 ? "empty" : null,
      fetchedAt,
      null,
    );
    liveCache = { expiresAt: Date.now() + CACHE_MS, body };
    return body;
  } catch {
    return publish(buildCatalog([], fetchedAt), "degraded", "upstream", fetchedAt, null);
  }
}
