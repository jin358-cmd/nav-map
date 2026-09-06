import type { LngLat } from "@/types/domain";

type ParkingCity = {
  id: string;
  label: string;
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
};

export const TDX_PARKING_CITIES: ParkingCity[] = [
  { id: "Taipei", label: "臺北市", minLat: 24.95, maxLat: 25.22, minLng: 121.45, maxLng: 121.67 },
  { id: "NewTaipei", label: "新北市", minLat: 24.68, maxLat: 25.32, minLng: 121.28, maxLng: 122.02 },
  { id: "Keelung", label: "基隆市", minLat: 25.07, maxLat: 25.2, minLng: 121.67, maxLng: 121.85 },
  { id: "Taoyuan", label: "桃園市", minLat: 24.82, maxLat: 25.13, minLng: 120.98, maxLng: 121.48 },
  { id: "Hsinchu", label: "新竹市", minLat: 24.76, maxLat: 24.86, minLng: 120.9, maxLng: 121.04 },
  { id: "HsinchuCounty", label: "新竹縣", minLat: 24.43, maxLat: 24.96, minLng: 120.92, maxLng: 121.36 },
  { id: "MiaoliCounty", label: "苗栗縣", minLat: 24.3, maxLat: 24.75, minLng: 120.62, maxLng: 121.26 },
  { id: "Taichung", label: "臺中市", minLat: 24.05, maxLat: 24.45, minLng: 120.45, maxLng: 121.05 },
  { id: "ChanghuaCounty", label: "彰化縣", minLat: 23.82, maxLat: 24.2, minLng: 120.22, maxLng: 120.68 },
  { id: "NantouCounty", label: "南投縣", minLat: 23.43, maxLat: 24.15, minLng: 120.6, maxLng: 121.35 },
  { id: "YunlinCounty", label: "雲林縣", minLat: 23.5, maxLat: 23.85, minLng: 120.15, maxLng: 120.68 },
  { id: "Chiayi", label: "嘉義市", minLat: 23.45, maxLat: 23.52, minLng: 120.4, maxLng: 120.49 },
  { id: "ChiayiCounty", label: "嘉義縣", minLat: 23.2, maxLat: 23.65, minLng: 120.15, maxLng: 120.75 },
  { id: "Tainan", label: "臺南市", minLat: 22.87, maxLat: 23.42, minLng: 120.02, maxLng: 120.58 },
  { id: "Kaohsiung", label: "高雄市", minLat: 22.47, maxLat: 23.28, minLng: 120.17, maxLng: 120.75 },
  { id: "PingtungCounty", label: "屏東縣", minLat: 21.9, maxLat: 22.88, minLng: 120.35, maxLng: 120.9 },
  { id: "YilanCounty", label: "宜蘭縣", minLat: 24.33, maxLat: 24.88, minLng: 121.3, maxLng: 121.95 },
  { id: "HualienCounty", label: "花蓮縣", minLat: 23.1, maxLat: 24.4, minLng: 121.1, maxLng: 121.8 },
  { id: "TaitungCounty", label: "臺東縣", minLat: 22.2, maxLat: 23.5, minLng: 120.8, maxLng: 121.6 },
  { id: "PenghuCounty", label: "澎湖縣", minLat: 23.18, maxLat: 23.8, minLng: 119.3, maxLng: 119.75 },
  { id: "KinmenCounty", label: "金門縣", minLat: 24.37, maxLat: 24.54, minLng: 118.23, maxLng: 118.52 },
  { id: "LienchiangCounty", label: "連江縣", minLat: 26.13, maxLat: 26.4, minLng: 119.9, maxLng: 120.5 },
];

export function parkingCitiesNear(center: LngLat, radiusKm: number): string[] {
  const latPad = Math.max(radiusKm, 8) / 111;
  const lngPad =
    Math.max(radiusKm, 8) / (111 * Math.max(Math.cos((center.lat * Math.PI) / 180), 0.2));
  const minLat = center.lat - latPad;
  const maxLat = center.lat + latPad;
  const minLng = center.lng - lngPad;
  const maxLng = center.lng + lngPad;
  const hits = TDX_PARKING_CITIES.filter(
    (city) =>
      city.minLat <= maxLat &&
      city.maxLat >= minLat &&
      city.minLng <= maxLng &&
      city.maxLng >= minLng,
  );
  if (hits.length) return hits.map((city) => city.id);

  let nearest = TDX_PARKING_CITIES[0];
  let best = Number.POSITIVE_INFINITY;
  for (const city of TDX_PARKING_CITIES) {
    const lat = (city.minLat + city.maxLat) / 2;
    const lng = (city.minLng + city.maxLng) / 2;
    const distance =
      (lat - center.lat) ** 2 +
      (lng - center.lng) ** 2;
    if (distance < best) {
      best = distance;
      nearest = city;
    }
  }
  return [nearest.id];
}

export function isInTainan(center: LngLat) {
  return parkingCitiesNear(center, 4).includes("Tainan");
}
