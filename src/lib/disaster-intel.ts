import { DISASTER_NEARBY_KM } from "@/lib/disaster-constants";
import { distanceKm } from "@/lib/geo";
import type { DisasterAlert, LngLat, RoadIntelItem } from "@/types/domain";

const KIND_LABEL: Record<DisasterAlert["kind"], string> = {
  flood: "積水",
  closure: "封路",
  quake: "地震",
  typhoon: "颱風",
  "heavy-rain": "豪雨",
  "strong-wind": "強風",
  landslide: "崩塌",
  other: "災害",
};

export function deriveDisasterIntel(
  alerts: DisasterAlert[],
  center: LngLat,
): RoadIntelItem[] {
  const items: RoadIntelItem[] = [];
  for (const alert of alerts) {
    const km = distanceKm(center, alert.location);
    const cityWide = alert.kind === "typhoon" || alert.kind === "quake";
    if (!cityWide && km > DISASTER_NEARBY_KM) continue;
    items.push({
      id: `intel-disaster-${alert.id}`,
      kind: "disaster",
      title: `${alert.severity === "emergency" ? "緊急" : alert.severity === "warning" ? "警戒" : "注意"}${KIND_LABEL[alert.kind]}`,
      detail: alert.title,
      distanceMeters: Math.round(km * 1000),
    });
  }
  return items
    .sort((a, b) => a.distanceMeters - b.distanceMeters)
    .slice(0, 6);
}
