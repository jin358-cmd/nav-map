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

export { fetchTainanCctv, fetchTainanTraffic, isTdxConfigured } from "./tdx";
export { fetchCctvCatalog } from "./cctv";
export {
  fetchAccidentReports,
  fetchDisasterAlerts,
} from "./disaster-api";
export { requestCurrentPosition, watchVehiclePosition } from "./geolocation";
