import { DISASTER_NEARBY_KM } from "@/lib/disaster-constants";
import { distanceKm } from "@/lib/geo";
import {
  DISASTER_ZOOM_COUNT,
  pickVisiblePoints,
  zoomVisibleLimit,
} from "@/lib/map-visibility";
import type { DisasterAlert, LngLat, MapViewport } from "@/types/domain";

const SEVERITY_RANK: Record<DisasterAlert["severity"], number> = {
  emergency: 3,
  warning: 2,
  watch: 1,
};

export function isCityWideDisaster(alert: DisasterAlert) {
  return alert.kind === "typhoon" || alert.kind === "quake";
}

export function mapVisibleDisasters(
  alerts: DisasterAlert[],
  viewport: MapViewport | null,
  origin: LngLat,
): DisasterAlert[] {
  const ranked = [...alerts]
    .map((alert) => ({
      alert,
      km: distanceKm(origin, alert.location),
    }))
    .filter(
      ({ alert, km }) => isCityWideDisaster(alert) || km <= DISASTER_NEARBY_KM,
    )
    .sort((a, b) => {
      const severity =
        SEVERITY_RANK[b.alert.severity] - SEVERITY_RANK[a.alert.severity];
      if (severity !== 0) return severity;
      return a.km - b.km;
    })
    .map(({ alert }) => alert);

  return pickVisiblePoints(ranked, {
    location: (alert) => alert.location,
    viewport,
    limit: zoomVisibleLimit(viewport?.zoom ?? 16, DISASTER_ZOOM_COUNT),
    prefer: (alert) =>
      isCityWideDisaster(alert) ||
      alert.severity === "emergency" ||
      alert.severity === "warning",
  });
}
