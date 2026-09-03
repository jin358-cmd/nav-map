import type { TravelMode } from "@/types/domain";

export const CAR_ROUTING_PROVIDER = "OSRM public driving (router.project-osrm.org)";
export const MOTORCYCLE_ROUTING_PROVIDER = "NOT CONFIGURED";

export function motorcycleRoutingConfigured() {
  return Boolean(process.env.MOTORCYCLE_ROUTING_URL?.trim());
}

export function formatEtaClock(durationSeconds: number, now = new Date()) {
  const arrival = new Date(now.getTime() + durationSeconds * 1000);
  return arrival.toLocaleTimeString("zh-TW", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

export function travelModeLabel(mode: TravelMode) {
  return mode === "motorcycle" ? "機車" : "汽車";
}
