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
    id: "intel-cctv",
    kind: "cctv",
    title: "前方 CCTV 中正／民生",
    detail: "鏡頭在線，北向車道綠燈週期",
    distanceMeters: 240,
  },
  {
    id: "intel-work",
    kind: "construction",
    title: "金華路夜間施工",
    detail: "機車道封閉，請靠內側通過",
    distanceMeters: 420,
  },
  {
    id: "intel-jam",
    kind: "congestion",
    title: "東門圓環壅塞",
    detail: "外側車道回堵約 600 公尺",
    distanceMeters: 1200,
  },
];
