import type { NavigationManeuver, RoadIntelItem } from "@/types/domain";

export const DEMO_MANEUVER: NavigationManeuver = {
  distanceMeters: 800,
  action: "右轉",
  roadName: "民生路一段",
  hint: "通往臺南火車站",
  remainingKm: 2.4,
  etaMinutes: 7,
};

export const AHEAD_INTEL: RoadIntelItem[] = [
  {
    id: "intel-work",
    kind: "construction",
    title: "金華路夜間施工",
    detail: "機車道封閉，請靠內側通過",
    distanceMeters: 420,
  },
];
