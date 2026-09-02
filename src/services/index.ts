import { AHEAD_INTEL, DEMO_MANEUVER } from "@/data/mock-navigation";
import { DEMO_ROUTE } from "@/data/mock-route";
import type { NavigationManeuver, RoadIntelItem } from "@/types/domain";

export async function fetchDemoRoute(): Promise<[number, number][]> {
  return DEMO_ROUTE;
}

export async function fetchNavigationManeuver(): Promise<NavigationManeuver> {
  return DEMO_MANEUVER;
}

export async function fetchAheadIntel(): Promise<RoadIntelItem[]> {
  return AHEAD_INTEL;
}

export { fetchAccidentReports } from "./accidents";
export { fetchCctvCatalog } from "./cctv";
export { requestCurrentPosition, watchVehiclePosition } from "./geolocation";
export { planDrivingRoute, searchAddresses } from "./routing";
