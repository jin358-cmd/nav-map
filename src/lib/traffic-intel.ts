import { CITY_TRAFFIC_NEARBY_KM } from "@/lib/traffic-constants";
import { trafficLevelLabel } from "@/lib/format";
import type { RoadIntelItem, TrafficLevel } from "@/types/domain";
import type { ScoredTrafficSegment } from "@/lib/traffic-query";

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
): RoadIntelItem | null {
  const alerts = scored.filter(
    (segment) =>
      segment.level !== "smooth" &&
      (segment.nearby || segment.alongRoute) &&
      (segment.alongRoute || segment.distanceKm <= maxDistanceKm),
  );
  if (!alerts.length) return null;

  const along = alerts.filter((segment) => segment.alongRoute);
  const pool = along.length ? along : alerts;
  const alert = [...pool].sort((a, b) => {
    if (Math.abs(a.distanceKm - b.distanceKm) > 0.35) {
      return a.distanceKm - b.distanceKm;
    }
    return LEVEL_WEIGHT[b.level] - LEVEL_WEIGHT[a.level];
  })[0];

  const prefix = alert.alongRoute ? "前方" : "附近";
  const speed =
    alert.speedKmh !== undefined
      ? ` · 時速 ${Math.round(alert.speedKmh)}`
      : "";
  const kindLabel = trafficLevelLabel(alert.level);

  return {
    id: `intel-traffic-${alert.id}`,
    kind: "congestion",
    title: `${prefix}${kindLabel}`,
    detail: `${alert.name}${speed}`,
    distanceMeters: Math.round(alert.distanceKm * 1000),
  };
}
