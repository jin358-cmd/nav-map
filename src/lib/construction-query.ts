import { ACCIDENT_ZOOM_COUNT, pickVisiblePoints, zoomVisibleLimit } from "@/lib/map-visibility";
import { distanceKm } from "@/lib/geo";
import type {
  ConstructionEvent,
  LngLat,
  MapViewport,
  RoadIntelItem,
} from "@/types/domain";

export function mapVisibleConstruction(
  items: ConstructionEvent[],
  viewport: MapViewport | null,
  origin: LngLat | null,
): ConstructionEvent[] {
  const ranked = origin
    ? [...items].sort(
        (a, b) =>
          distanceKm(origin, a.location) - distanceKm(origin, b.location),
      )
    : [...items];
  return pickVisiblePoints(ranked, {
    location: (item) => item.location,
    viewport,
    limit: zoomVisibleLimit(viewport?.zoom ?? 16, ACCIDENT_ZOOM_COUNT),
  });
}

export function deriveConstructionIntel(
  items: ConstructionEvent[],
  origin: LngLat | null,
): RoadIntelItem[] {
  if (!origin) return [];
  return items
    .map((item) => ({
      id: `intel-construction-${item.id}`,
      eventId: item.id,
      kind: "construction" as const,
      title: item.title,
      detail: item.description,
      distanceMeters: Math.round(distanceKm(origin, item.location) * 1000),
      location: item.location,
      freshness: item.freshness,
    }))
    .sort((a, b) => a.distanceMeters - b.distanceMeters);
}
