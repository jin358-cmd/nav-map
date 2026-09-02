import type { VehiclePose } from "@/types/domain";

/** 臺南中西區／中正路示範駕駛起點 */
export const TAINAN_CENTER = {
  lng: 120.2049,
  lat: 22.9878,
} as const;

export const DEMO_VEHICLE: VehiclePose = {
  lng: 120.2049,
  lat: 22.9878,
  heading: 8,
  source: "demo",
};

export const DRIVING_PITCH = 60;
export const DRIVING_ZOOM = 17.15;
export const DRIVING_ZOOM_MOBILE = 16.7;
export const OVERHEAD_ZOOM = 15.4;

/** 車子約在可見駕駛區下方 30%：上方 padding 約 40% 拉開前方視野 */
export const DRIVING_PADDING_RATIO = 0.4;

export const MAP_COLORS = {
  background: "#0b0d11",
  water: "#10141c",
  land: "#13161d",
  park: "#141a17",
  building: "#1b2230",
  buildingExtrusion: "#222a38",
  roadMinor: "#3d4e64",
  roadMajor: "#526781",
  roadMotorway: "#6d87a3",
  roadCasing: "#1c2430",
  roadLabel: "#8ea0b8",
  route: "#3ee0ff",
  routeGlow: "#1ad0ff",
  cctv: "#c084fc",
  accident: "#ff3b3b",
  congestion: "#ff6b35",
  disaster: "#ff9f1c",
} as const;

export const OPENFREEMAP_DARK_STYLE =
  "https://tiles.openfreemap.org/styles/dark";

export const YOUTUBE_MUSIC_URL = "https://music.youtube.com/";
