import type { CctvCamera, RoadIntelItem } from "@/types/domain";

export function roadIntelFromCameras(
  cameras: CctvCamera[],
  extras: RoadIntelItem[],
  limit = 2,
): RoadIntelItem[] {
  const cctvItems = cameras.slice(0, limit).map((camera) => {
    const meters = Math.round((camera.distanceKm ?? 0) * 1000);
    const prefix = camera.alongRoute || camera.ahead ? "前方" : "附近";
    const kind = camera.sourceType === "freeway" ? "國道" : "市區";
    return {
      id: `intel-${camera.id}`,
      kind: "cctv" as const,
      title: camera.intersection,
      detail: `${prefix} CCTV · ${kind}`,
      distanceMeters: meters,
      cameraId: camera.id,
    };
  });

  const rest = extras.filter((item) => item.kind !== "cctv");
  return [...cctvItems, ...rest];
}
