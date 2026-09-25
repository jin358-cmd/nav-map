export const TDX_SOUTH_REGIONS = [
  { id: "YunlinCounty", city: "雲林縣" },
  { id: "ChiayiCounty", city: "嘉義縣" },
  { id: "Chiayi", city: "嘉義市" },
  { id: "Tainan", city: "臺南市" },
  { id: "Kaohsiung", city: "高雄市" },
  { id: "PingtungCounty", city: "屏東縣" },
] as const;

export type TdxSouthRegionId = (typeof TDX_SOUTH_REGIONS)[number]["id"];

export function isTdxSouthRegion(value: string): value is TdxSouthRegionId {
  return TDX_SOUTH_REGIONS.some((region) => region.id === value);
}
