import type { TravelMode } from "@/types/domain";

export const CAR_ROUTING_PROVIDER =
  "OSRM car (OSRM_CAR_URL, or the public driving demo when unset)";
export const MOTORCYCLE_ROUTING_PROVIDER =
  "OSRM motorcycle (OSRM_MOTORCYCLE_URL, Taiwan scooter profile)";

export function directionsModeQuery(mode: TravelMode): TravelMode {
  return mode === "motorcycle" ? "motorcycle" : "car";
}

/** Route-preview toggle: a chosen destination is replanned in the new mode. */
export function travelModeSwitch(next: TravelMode, hasDestination: boolean) {
  return {
    mode: directionsModeQuery(next),
    replan: hasDestination,
  };
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
