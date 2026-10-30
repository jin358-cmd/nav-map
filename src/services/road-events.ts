import "server-only";
import { buildRoadEventCatalog, type RoadEventCatalog } from "@/lib/road-events/catalog";
import {
  fetchOpenConstruction,
  type OpenConstructionReport,
} from "@/lib/road-events/fetch-open-data";
import {
  fetchTdxLiveSources,
  TDX_LIVE_SOURCES,
  type TdxSourceFetch,
} from "@/lib/road-events/tdx-http";
import { getTdxCredentials, isTdxConfigured } from "@/services/tdx-client";

const CACHE_MS = 10 * 60 * 1000;

let openCache: { expiresAt: number; reports: OpenConstructionReport[] } | null = null;
let tainanCache: { expiresAt: number; result: TdxSourceFetch } | null = null;

export async function loadOpenConstructionReports() {
  if (openCache && openCache.expiresAt > Date.now()) return openCache.reports;
  const reports = await fetchOpenConstruction();
  openCache = { expiresAt: Date.now() + CACHE_MS, reports };
  return reports;
}

export async function loadTainanTdxEvents() {
  if (!isTdxConfigured()) return null;
  if (tainanCache && tainanCache.expiresAt > Date.now()) return tainanCache.result;
  const credentials = getTdxCredentials();
  if (!credentials) return null;
  const [result] = await fetchTdxLiveSources({
    credentials,
    sources: TDX_LIVE_SOURCES.filter((source) => source.id === "tdx:City:Tainan"),
  });
  if (result?.ok) tainanCache = { expiresAt: Date.now() + CACHE_MS, result };
  return result ?? null;
}

export async function loadRoadEventCatalog(options?: {
  includeTdx?: boolean;
}): Promise<RoadEventCatalog & { fetchedAt: string; openReports: OpenConstructionReport[] }> {
  const openReports = await loadOpenConstructionReports();
  const credentials = options?.includeTdx ? getTdxCredentials() : null;
  const tdx = credentials ? await fetchTdxLiveSources({ credentials }) : [];
  return {
    ...buildRoadEventCatalog([...tdx, ...openReports]),
    openReports,
    fetchedAt: new Date().toISOString(),
  };
}
