import { TAINAN_TRAFFIC } from "@/data/mock-traffic";
import type { CctvCamera, TrafficSegment } from "@/types/domain";

/**
 * TDX (Transport Data eXchange) service layer.
 * Phase 1 returns mock Tainan datasets.
 * Phase 2 will authenticate against MOTC TDX and swap these implementations.
 */
const tdxClientId = process.env.NEXT_PUBLIC_TDX_CLIENT_ID;
const tdxEnabled = Boolean(tdxClientId);

export function isTdxConfigured(): boolean {
  return tdxEnabled;
}

export async function fetchTainanCctv(): Promise<CctvCamera[]> {
  const { fetchCctvCatalog } = await import("@/services/cctv");
  const catalog = await fetchCctvCatalog();
  return catalog.cameras;
}

export async function fetchTainanTraffic(): Promise<TrafficSegment[]> {
  if (!tdxEnabled) {
    return TAINAN_TRAFFIC;
  }

  // Reserved: GET /v2/Traffic/LiveTraffic/City/Tainan
  return TAINAN_TRAFFIC;
}

export async function fetchCctvSnapshotUrl(cameraId: string): Promise<string | null> {
  void cameraId;
  if (!tdxEnabled) {
    return null;
  }

  // Reserved: TDX CCTV ImageUrl
  return null;
}
