import type { GeocodeHit } from "@/types/domain";

export const TAIWAN_LANDMARKS: GeocodeHit[] = [
  {
    id: "lm-tainan-station",
    name: "臺南火車站",
    address: "臺南市中西區北門路二段",
    location: { lng: 120.21258, lat: 22.99721 },
  },
  {
    id: "lm-anping",
    name: "安平古堡",
    address: "臺南市安平區國勝路",
    location: { lng: 120.1607, lat: 23.0016 },
  },
  {
    id: "lm-ncku",
    name: "國立成功大學",
    address: "臺南市東區大學路",
    location: { lng: 120.2197, lat: 22.9967 },
  },
  {
    id: "lm-chimei",
    name: "奇美博物館",
    address: "臺南市仁德區文華路二段",
    location: { lng: 120.2279, lat: 22.9346 },
  },
  {
    id: "lm-tainan-city-hall",
    name: "臺南市政府",
    address: "臺南市安平區永華路二段",
    location: { lng: 120.185, lat: 22.992 },
  },
  {
    id: "lm-shennong",
    name: "台南文化創意產業園區",
    address: "臺南市東區北門路二段16號",
    location: { lng: 120.2121, lat: 22.9984 },
  },
];

const LANDMARK_ALIASES: Record<string, string[]> = {
  "lm-tainan-station": ["火車站", "台南車站", "台南站", "TRA"],
  "lm-anping": ["安平", "古堡", "熱蘭遮"],
  "lm-ncku": ["成大", "NCKU", "成功大學"],
  "lm-chimei": ["奇美", "博物館"],
  "lm-tainan-city-hall": ["市府", "市政府", "永華"],
  "lm-shennong": ["文創園區", "舊台南工場"],
};

function normalize(value: string) {
  return value.toLowerCase().replaceAll("臺", "台").replaceAll(" ", "");
}

const DEMO_PRESET_IDS = new Set([
  "lm-tainan-station",
  "lm-anping",
  "lm-ncku",
  "lm-chimei",
  "lm-tainan-city-hall",
]);

export function isDemoLandmarkPreset(hit: Pick<GeocodeHit, "id">) {
  return DEMO_PRESET_IDS.has(hit.id);
}

export function matchLandmarks(query: string, limit = 4): GeocodeHit[] {
  const needle = normalize(query);
  if (needle.length < 1) return TAIWAN_LANDMARKS.slice(0, limit);
  return TAIWAN_LANDMARKS.filter((item) => {
    const extra = LANDMARK_ALIASES[item.id]?.join(" ") ?? "";
    const hay = normalize(`${item.name} ${item.address} ${extra}`);
    return hay.includes(needle) || extra.split(" ").some((alias) => normalize(alias) === needle);
  }).slice(0, limit);
}
