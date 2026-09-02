import fallbackCatalog from "@/data/cctv-fallback.json";
import { TAINAN_CCTV } from "@/data/mock-cctv";
import { CCTV_CATALOG_CACHE_MS } from "@/lib/cctv-constants";
import {
  normalizeFallbackCamera,
  type CctvFallbackRecord,
} from "@/lib/cctv-normalize";
import type { CctvCamera, CctvDataOrigin } from "@/types/domain";

type CatalogCache = {
  cameras: CctvCamera[];
  origin: CctvDataOrigin;
  fetchedAt: number;
};

let catalogCache: CatalogCache | null = null;

function fromMock(): CctvCamera[] {
  return TAINAN_CCTV.map((camera) => ({ ...camera, dataOrigin: "mock" as const }));
}

function fromSnapshot(): CctvCamera[] {
  const records = fallbackCatalog.cameras as CctvFallbackRecord[];
  return records
    .map((record) => normalizeFallbackCamera(record, "snapshot"))
    .filter((camera): camera is CctvCamera => Boolean(camera));
}

async function fromTdxLive(): Promise<CctvCamera[] | null> {
  // Reserved: MOTC TDX City + Freeway CCTV. Credentials stay on /api only.
  return null;
}

export async function fetchCctvCatalog(force = false): Promise<{
  cameras: CctvCamera[];
  origin: CctvDataOrigin;
}> {
  if (
    !force &&
    catalogCache &&
    Date.now() - catalogCache.fetchedAt < CCTV_CATALOG_CACHE_MS
  ) {
    return catalogCache;
  }

  const live = await fromTdxLive();
  if (live?.length) {
    catalogCache = { cameras: live, origin: "tdx-live", fetchedAt: Date.now() };
    return catalogCache;
  }

  try {
    const snapshot = fromSnapshot();
    if (snapshot.length) {
      catalogCache = {
        cameras: snapshot,
        origin: "snapshot",
        fetchedAt: Date.now(),
      };
      return catalogCache;
    }
  } catch {
    // Snapshot import failed; fall through to mock.
  }

  catalogCache = { cameras: fromMock(), origin: "mock", fetchedAt: Date.now() };
  return catalogCache;
}

export function peekCctvCatalogOrigin(): CctvDataOrigin | null {
  return catalogCache?.origin ?? null;
}
