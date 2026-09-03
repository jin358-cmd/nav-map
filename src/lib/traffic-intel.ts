import { CITY_TRAFFIC_NEARBY_KM } from "@/lib/traffic-constants";
import { trafficLevelLabel } from "@/lib/format";
import type { RoadIntelItem, TrafficLevel } from "@/types/domain";
import { segmentAnchor, type ScoredTrafficSegment } from "@/lib/traffic-query";

const LEVEL_WEIGHT: Record<TrafficLevel, number> = {
  blocked: 5,
  severe: 4,
  congested: 3,
  slow: 2,
  smooth: 0,
};

export function deriveTrafficIntel(
  scored: ScoredTrafficSegment[],
  maxDistanceKm = CITY_TRAFFIC_NEARBY_KM,
): RoadIntelItem[] {
  const alerts = scored.filter(
    (segment) =>
      segment.level !== "smooth" &&
      (segment.nearby || segment.alongRoute) &&
      (segment.alongRoute || segment.distanceKm <= maxDistanceKm),
  );
  return [...alerts]
    .sort((a, b) => {
      if (Math.abs(a.distanceKm - b.distanceKm) > 0.35) {
        return a.distanceKm - b.distanceKm;
      }
      return LEVEL_WEIGHT[b.level] - LEVEL_WEIGHT[a.level];
    })
    .map((alert) => {
      const prefix = alert.alongRoute ? "前方" : "附近";
      const speed =
        alert.speedKmh !== undefined
          ? ` · 時速 ${Math.round(alert.speedKmh)}`
          : "";
      return {
        id: `intel-traffic-${alert.id}`,
        eventId: alert.id,
        kind: "congestion" as const,
        title: `${prefix}${trafficLevelLabel(alert.level)}`,
        detail: `${alert.name}${speed}`,
        distanceMeters: Math.round(alert.distanceKm * 1000),
        location: segmentAnchor(alert),
      };
    });
}
