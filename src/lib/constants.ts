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

export const DRIVING_PITCH = 52;
/**
 * 導航第一人稱前視。MapLibre pitch 不是駕駛「仰角」。
 * pitch≈56 約等於視線低於水平 34°，畫面呈現約 35° 道路前視。
 */
export const NAVIGATION_PITCH = 56;
export const OVERVIEW_PITCH = 0;
export const DRIVING_ZOOM = 16.75;
export const DRIVING_ZOOM_MOBILE = 16.45;
export const OVERHEAD_ZOOM = 15.4;
/** 2D 導航 cruise，比瀏覽俯視更近，仍留出路口預判距離。 */
export const OVERHEAD_NAV_ZOOM = 16.35;
export const OVERHEAD_NAV_ZOOM_MOBILE = 16.15;
export const OVERHEAD_TURN_ZOOM = 17.35;
export const OVERHEAD_TURN_ZOOM_MOBILE = 17.15;
/** 路口近距離上限，避免無限放大。 */
export const INTERSECTION_ZOOM = 18.15;
export const INTERSECTION_ZOOM_MOBILE = 17.85;
export const INTERSECTION_PITCH = 50;
export const INTERSECTION_APPROACH_METERS = 95;
export const CRUISE_ZOOM_START_METERS = 500;
export const PREPARE_ZOOM_METERS = 200;
export const TURN_VIEW_METERS = 50;
export const CONSECUTIVE_TURN_METERS = 160;
/** 50 公尺進入路口強化；65 公尺才退出，避免 49～51 閃爍 */
export const JUNCTION_FOCUS_ENTER_METERS = 50;
export const JUNCTION_FOCUS_EXIT_METERS = 65;
export const JUNCTION_FOCUS_MAX_ZOOM_METERS = 12;
/** 三段轉向：200 開始拉近／100 Approach／30 Turn View */
export const MANEUVER_PREPARE_METERS = 200;
export const MANEUVER_PREPARE_EXIT_METERS = 220;
export const MANEUVER_APPROACH_METERS = 100;
export const MANEUVER_APPROACH_EXIT_METERS = 118;
export const MANEUVER_IMMINENT_METERS = 30;
export const MANEUVER_AFTER_TURN_METERS = 48;
export const MANEUVER_RECOVER_MS = 1800;
/** 懸空橘色箭頭：200 公尺開始出現 */
export const GUIDANCE_ARROW_APPROACH_METERS = 200;

/** 瀏覽時車輛約在畫面 65%；導航 3D 時約 72%（70～75）。 */
export const BROWSE_VEHICLE_Y = 0.65;
export const NAV_VEHICLE_Y = 0.72;
/** 羅盤方向參考扇形半角（視覺輔助，非 GPS 誤差）。 */
export const HEADING_REFERENCE_HALF_DEG = 24;

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
  maneuver: "#f97316",
  maneuverGlow: "#fdba74",
  cctv: "#c084fc",
  accident: "#ff3b3b",
  congestion: "#ff6b35",
  disaster: "#ff9f1c",
} as const;

export const OPENFREEMAP_DARK_STYLE =
  "https://tiles.openfreemap.org/styles/dark";

export const YOUTUBE_MUSIC_URL = "https://music.youtube.com/";

export type YoutubePlaylist = {
  id: string;
  label: string;
  hint: string;
  videoIds?: readonly string[];
  youtubeListId?: string;
};

/** 車用聆聽播放清單（可嵌入的 YouTube 24h 電台） */
export const YOUTUBE_PLAYLISTS: readonly YoutubePlaylist[] = [
  {
    id: "drive",
    label: "開車",
    hint: "駕駛混音",
    videoIds: ["jfKfPfyJRdk", "4xDzrJKXOOY"],
  },
  {
    id: "lofi",
    label: "Lo-fi",
    hint: "專注路況",
    videoIds: ["jfKfPfyJRdk"],
  },
  {
    id: "night",
    label: "夜車",
    hint: "Synthwave",
    videoIds: ["4xDzrJKXOOY"],
  },
  {
    id: "chill",
    label: "Chill",
    hint: "Chillhop",
    videoIds: ["5yx6BWlEVcY"],
  },
] as const;

export const YOUTUBE_DRIVE_MIX_IDS = YOUTUBE_PLAYLISTS[0].videoIds;
