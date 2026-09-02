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

export const DRIVING_PITCH = 48;
/** 開始導航後鏡頭壓低，多看路面、少看天空 */
export const NAVIGATION_PITCH = 32;
export const OVERVIEW_PITCH = 0;
export const DRIVING_ZOOM = 17.15;
export const DRIVING_ZOOM_MOBILE = 16.7;
export const OVERHEAD_ZOOM = 15.4;
/** 接近路口時自動放大，看清轉向 */
export const INTERSECTION_ZOOM = 18.65;
export const INTERSECTION_ZOOM_MOBILE = 18.25;
export const INTERSECTION_PITCH = 40;
export const INTERSECTION_APPROACH_METERS = 95;
/** 跑馬燈箭頭：接近路口約 30 公尺才顯現 */
export const GUIDANCE_ARROW_APPROACH_METERS = 30;

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

export type YoutubePlaylist = {
  id: string;
  label: string;
  hint: string;
  videoIds: readonly string[];
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
