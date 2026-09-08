import type { VehiclePose } from "@/types/domain";

/** 臺南中西區／中正路示範駕駛起點（不得再當開機定位） */
export const TAINAN_CENTER = {
  lng: 120.2049,
  lat: 22.9878,
} as const;

/** 尚未取得 GPS 時的全島總覽，避免先落到臺南預設街景。 */
export const TAIWAN_OVERVIEW = {
  lng: 120.96,
  lat: 23.7,
} as const;
export const TAIWAN_OVERVIEW_ZOOM = 7.15;

export const DEMO_VEHICLE: VehiclePose = {
  lng: 120.2049,
  lat: 22.9878,
  heading: 8,
  source: "demo",
};

export const DRIVING_PITCH = 50;
/**
 * 3D 駕駛視角：pitch 50°（相機在車後上方往前看）。
 * 建物可見頂面與立面，地面光圈清楚，消失點約在畫面中上。
 */
export const NAVIGATION_PITCH = 50;
/** 直式導航與橫式同一 3D 仰角。 */
export const NAVIGATION_PITCH_PORTRAIT = 50;
export const INTERSECTION_PITCH_PORTRAIT = 52;
export const DRIVING_ZOOM_PORTRAIT = 17.98;
export const OVERVIEW_PITCH = 0;
export const DRIVING_ZOOM = 17.72;
export const DRIVING_ZOOM_MOBILE = 17.46;
export const OVERHEAD_ZOOM = 15.4;
/** 2D 導航 cruise：再近一級，仍留出路口預判距離。 */
export const OVERHEAD_NAV_ZOOM = 16.95;
export const OVERHEAD_NAV_ZOOM_MOBILE = 16.75;
export const OVERHEAD_TURN_ZOOM = 17.55;
export const OVERHEAD_TURN_ZOOM_MOBILE = 17.35;
/** 直立 2D 路口：再拉近，讓路標落在畫面中下。 */
export const OVERHEAD_TURN_ZOOM_PORTRAIT = 18.08;
/** 路口近距離上限，避免無限放大。 */
export const INTERSECTION_ZOOM = 18.28;
export const INTERSECTION_ZOOM_MOBILE = 18.05;
/** 直式 3D 路口鏡頭上限：接近黃線時放大到此即停止。 */
export const INTERSECTION_ZOOM_PORTRAIT = 18.52;
export const INTERSECTION_PITCH = 52;
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
/** 立體弓型導覽標示：轉彎前 150 公尺出現 */
export const GUIDANCE_SIGN_APPROACH_METERS = 150;
export const GUIDANCE_SIGN_EXIT_METERS = 168;
/** 地面藍色弓型箭頭：約 200 公尺開始出現，近路口加密加亮 */
export const GROUND_BOW_APPROACH_METERS = 200;
export const GROUND_BOW_EXIT_METERS = 218;
/** @deprecated 改用 GUIDANCE_SIGN_APPROACH_METERS */
export const GUIDANCE_ARROW_APPROACH_METERS = GUIDANCE_SIGN_APPROACH_METERS;
/** 直式：黃線出現後開始拉近，到此距離達上限並維持。 */
export const PORTRAIT_APPROACH_ZOOM_START_METERS = GUIDANCE_SIGN_APPROACH_METERS;
export const PORTRAIT_APPROACH_ZOOM_FULL_METERS = 45;

/** 瀏覽 3D：車輛約在畫面下三分之一；導航 3D 略再偏低，前方視野拉長。 */
export const BROWSE_VEHICLE_Y = 0.68;
export const NAV_VEHICLE_Y = 0.72;
/** 直立 2D 導航：車輛偏下，前方路口／路標在畫面中下。 */
export const NAV_2D_PORTRAIT_VEHICLE_Y = 0.78;
/** Landscape 導航：車頭約在畫面 70% x、79～80% y（中央偏右下，不貼邊）。 */
export const NAV_LANDSCAPE_VEHICLE_X = 0.7;
export const NAV_LANDSCAPE_VEHICLE_Y = 0.795;
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
