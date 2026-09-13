export const SOUTH_PILOT_REGIONS = [
  "雲林縣",
  "嘉義市",
  "嘉義縣",
  "臺南市",
  "高雄市",
  "屏東縣",
] as const;

export type SouthPilotCounty = (typeof SOUTH_PILOT_REGIONS)[number];

export const SOUTH_PILOT_SET = new Set<string>(SOUTH_PILOT_REGIONS);

export const SOUTH_POI_DATA_VERSION = "south-pilot-20260913-batch10";

export function isSouthPilotCounty(value: string | null | undefined) {
  return Boolean(value && SOUTH_PILOT_SET.has(value));
}
