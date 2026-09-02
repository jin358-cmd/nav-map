import { CITY_TRAFFIC_NEARBY_KM } from "@/lib/traffic-constants";
import { trafficLevelLabel } from "@/lib/format";
import type { RoadIntelItem } from "@/types/domain";
import type { ScoredTrafficSegment } from "@/lib/traffic-query";

export function deriveTrafficIntel(
  scored: ScoredTrafficSegment[],
): RoadIntelItem | null {
  const alert = scored.find(
    (segment) =>
      segment.level !== "smooth" &&
      (segment.nearby || segment.alongRoute) &&
      segment.distanceKm <= CITY_TRAFFIC_NEARBY_KM,
  );
  if (!alert) return null;

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
