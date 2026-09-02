import "server-only";
import { TAINAN_DISASTERS } from "@/data/mock-disasters";
import { DISASTER_LIVE_CACHE_MS } from "@/lib/disaster-constants";
import {
  finalizeDisasterAlert,
  normalizeNcdrEntries,
  unwrapNcdrEntries,
} from "@/lib/disaster-normalize";
import { fetchNcdrAlertFeed } from "@/services/ncdr-client";
import type { DisasterCatalog, DisasterDataOrigin } from "@/types/domain";

let liveCache: DisasterCatalog | null = null;
let liveCacheAt = 0;

export async function loadTainanDisasters(
  force = false,
): Promise<DisasterCatalog> {
  if (
    !force &&
    liveCache &&
    Date.now() - liveCacheAt < DISASTER_LIVE_CACHE_MS
  ) {
    return liveCache;
  }

  const live = await fromNcdrLive();
  const catalog = live ?? fromMock();
  liveCache = catalog;
  liveCacheAt = Date.now();
  return catalog;
}

function fromMock(): DisasterCatalog {
  const now = new Date().toISOString();
  return {
    origin: "mock",
    alerts: TAINAN_DISASTERS.map((alert) =>
      finalizeDisasterAlert({
        ...alert,
        dataOrigin: "mock",
        updatedAt: now,
      }),
    ),
    fetchedAt: now,
  };
}

async function fromNcdrLive(): Promise<DisasterCatalog | null> {
  try {
    const payload = await fetchNcdrAlertFeed();
    const entries = unwrapNcdrEntries(payload);
    if (!entries.length) return null;

    return {
      origin: "ncdr-live",
      alerts: normalizeNcdrEntries(entries),
      fetchedAt: new Date().toISOString(),
    };
  } catch (error) {
    console.warn(
      "NCDR live disasters fallback to mock",
      error instanceof Error ? error.message : "unknown error",
    );
    return null;
  }
}

export function disasterPublishSource(origin: DisasterDataOrigin) {
  return origin === "ncdr-live" ? "ncdr" : "mock";
}
