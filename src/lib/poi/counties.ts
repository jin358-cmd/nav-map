export const TAIWAN_COUNTIES = [
  "臺北市",
  "新北市",
  "桃園市",
  "臺中市",
  "臺南市",
  "高雄市",
  "基隆市",
  "新竹市",
  "新竹縣",
  "苗栗縣",
  "彰化縣",
  "南投縣",
  "雲林縣",
  "嘉義市",
  "嘉義縣",
  "屏東縣",
  "宜蘭縣",
  "花蓮縣",
  "臺東縣",
  "澎湖縣",
  "金門縣",
  "連江縣",
] as const;

export type TaiwanCounty = (typeof TAIWAN_COUNTIES)[number];

type CountyBox = {
  name: TaiwanCounty;
  south: number;
  north: number;
  west: number;
  east: number;
};

/** Smaller / offshore boxes first so they win over surrounding counties. */
const COUNTY_BOXES: CountyBox[] = [
  { name: "連江縣", south: 25.93, north: 26.39, west: 119.9, east: 120.52 },
  { name: "金門縣", south: 24.37, north: 24.54, west: 118.2, east: 118.52 },
  { name: "澎湖縣", south: 23.18, north: 23.8, west: 119.3, east: 119.75 },
  { name: "基隆市", south: 25.1, north: 25.2, west: 121.68, east: 121.8 },
  { name: "新竹市", south: 24.76, north: 24.86, west: 120.9, east: 121.04 },
  { name: "嘉義市", south: 23.45, north: 23.52, west: 120.42, east: 120.49 },
  { name: "臺北市", south: 24.96, north: 25.21, west: 121.45, east: 121.67 },
  { name: "宜蘭縣", south: 24.33, north: 24.88, west: 121.32, east: 121.98 },
  { name: "桃園市", south: 24.82, north: 25.13, west: 120.98, east: 121.48 },
  { name: "新竹縣", south: 24.42, north: 24.9, west: 120.88, east: 121.36 },
  { name: "苗栗縣", south: 24.3, north: 24.75, west: 120.62, east: 121.26 },
  { name: "臺中市", south: 24.0, north: 24.45, west: 120.45, east: 121.45 },
  { name: "彰化縣", south: 23.82, north: 24.2, west: 120.22, east: 120.68 },
  { name: "南投縣", south: 23.43, north: 24.15, west: 120.68, east: 121.3 },
  { name: "雲林縣", south: 23.5, north: 23.86, west: 120.15, east: 120.72 },
  { name: "嘉義縣", south: 23.2, north: 23.62, west: 120.18, east: 120.8 },
  { name: "臺南市", south: 22.87, north: 23.42, west: 120.02, east: 120.66 },
  { name: "高雄市", south: 22.48, north: 23.28, west: 120.17, east: 120.97 },
  { name: "屏東縣", south: 21.9, north: 22.88, west: 120.36, east: 120.9 },
  { name: "花蓮縣", south: 23.1, north: 24.4, west: 121.15, east: 121.78 },
  { name: "臺東縣", south: 22.2, north: 23.45, west: 120.8, east: 121.62 },
  { name: "新北市", south: 24.85, north: 25.3, west: 121.28, east: 122.01 },
];

const CITY_ALIASES: [RegExp, TaiwanCounty][] = [
  [/台北市|臺北市/, "臺北市"],
  [/新北市/, "新北市"],
  [/桃園市|桃園縣/, "桃園市"],
  [/台中市|臺中市/, "臺中市"],
  [/台南市|臺南市/, "臺南市"],
  [/高雄市/, "高雄市"],
  [/基隆市/, "基隆市"],
  [/新竹市/, "新竹市"],
  [/新竹縣/, "新竹縣"],
  [/苗栗/, "苗栗縣"],
  [/彰化/, "彰化縣"],
  [/南投/, "南投縣"],
  [/雲林/, "雲林縣"],
  [/嘉義市/, "嘉義市"],
  [/嘉義縣/, "嘉義縣"],
  [/屏東/, "屏東縣"],
  [/宜蘭/, "宜蘭縣"],
  [/花蓮/, "花蓮縣"],
  [/台東|臺東/, "臺東縣"],
  [/澎湖/, "澎湖縣"],
  [/金門/, "金門縣"],
  [/連江|馬祖/, "連江縣"],
];

export function countyFromText(value: string | null | undefined): TaiwanCounty | null {
  if (!value) return null;
  for (const [pattern, name] of CITY_ALIASES) {
    if (pattern.test(value)) return name;
  }
  return null;
}

export function countyFromLngLat(lat: number, lng: number): TaiwanCounty | null {
  for (const box of COUNTY_BOXES) {
    if (lat >= box.south && lat <= box.north && lng >= box.west && lng <= box.east) {
      return box.name;
    }
  }
  return null;
}

export function countyMentionedInQuery(query: string): TaiwanCounty | null {
  return countyFromText(query);
}
