import { ACCIDENT_ZOOM_COUNT, pickVisiblePoints, zoomVisibleLimit } from "@/lib/map-visibility";
import { distanceKm } from "@/lib/geo";
import type {
  AccidentReport,
  LngLat,
  MapViewport,
  RoadIntelItem,
} from "@/types/domain";

export function mapVisibleAccidents(
  accidents: AccidentReport[],
  viewport: MapViewport | null,
  origin: LngLat,
): AccidentReport[] {
  const ranked = [...accidents].sort(
    (a, b) =>
      distanceKm(origin, a.location) - distanceKm(origin, b.location),
  );
  return pickVisiblePoints(ranked, {
    location: (accident) => accident.location,
    viewport,
    limit: zoomVisibleLimit(viewport?.zoom ?? 16, ACCIDENT_ZOOM_COUNT),
  });
}

export function deriveAccidentIntel(
  accidents: AccidentReport[],
  origin: LngLat,
): RoadIntelItem[] {
  return accidents.map((accident) => ({
    id: `intel-accident-${accident.id}`,
    kind: "accident",
    title: accident.title,
    detail: accident.description,
    distanceMeters: Math.round(distanceKm(origin, accident.location) * 1000),
  }));
}
