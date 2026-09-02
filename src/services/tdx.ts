import type { CctvCamera, TrafficSegment } from "@/types/domain";

export async function fetchTainanCctv(): Promise<CctvCamera[]> {
  const { fetchCctvCatalog } = await import("@/services/cctv");
  const catalog = await fetchCctvCatalog();
  return catalog.cameras;
}

export async function fetchTainanTraffic(): Promise<TrafficSegment[]> {
  const { loadTainanTraffic } = await import("@/services/traffic");
  const catalog = await loadTainanTraffic();
  return catalog.segments;
}

export async function fetchCctvSnapshotUrl(
  cameraId: string,
): Promise<string | null> {
  void cameraId;
  return null;
}
