import { TAINAN_CENTER } from "@/lib/constants";
import type { DisasterKind, LngLat } from "@/types/domain";

export const TAINAN_CITY_LABELS = ["臺南市", "台南市", "臺南", "台南"] as const;

/** District centroids for placing NCDR markers when CAP has no geometry. */
export const TAINAN_DISTRICT_CENTROIDS: Record<string, LngLat> = {
  中西區: { lng: 120.2047, lat: 22.9908 },
  東區: { lng: 120.2283, lat: 22.9814 },
  南區: { lng: 120.1885, lat: 22.9616 },
  北區: { lng: 120.2068, lat: 23.0101 },
  安平區: { lng: 120.1649, lat: 22.995 },
  安南區: { lng: 120.1866, lat: 23.0476 },
  永康區: { lng: 120.2573, lat: 23.0264 },
  歸仁區: { lng: 120.2939, lat: 22.9672 },
  新化區: { lng: 120.3108, lat: 23.0385 },
  左鎮區: { lng: 120.4076, lat: 23.0568 },
  玉井區: { lng: 120.461, lat: 23.124 },
  楠西區: { lng: 120.485, lat: 23.175 },
  南化區: { lng: 120.543, lat: 23.043 },
  仁德區: { lng: 120.2518, lat: 22.9716 },
  關廟區: { lng: 120.3278, lat: 22.9613 },
  龍崎區: { lng: 120.3606, lat: 22.9656 },
  官田區: { lng: 120.3158, lat: 23.1947 },
  麻豆區: { lng: 120.2413, lat: 23.1814 },
  佳里區: { lng: 120.1769, lat: 23.1651 },
  西港區: { lng: 120.2026, lat: 23.1233 },
  七股區: { lng: 120.1396, lat: 23.1414 },
  將軍區: { lng: 120.1269, lat: 23.1993 },
  學甲區: { lng: 120.1843, lat: 23.232 },
  北門區: { lng: 120.1256, lat: 23.2678 },
  新營區: { lng: 120.317, lat: 23.31 },
  後壁區: { lng: 120.3609, lat: 23.3663 },
  白河區: { lng: 120.4158, lat: 23.3513 },
  東山區: { lng: 120.4042, lat: 23.326 },
  六甲區: { lng: 120.3802, lat: 23.232 },
  下營區: { lng: 120.2647, lat: 23.236 },
  柳營區: { lng: 120.3116, lat: 23.2778 },
  鹽水區: { lng: 120.2667, lat: 23.32 },
  善化區: { lng: 120.2969, lat: 23.1332 },
  大內區: { lng: 120.3987, lat: 23.1195 },
  山上區: { lng: 120.3535, lat: 23.104 },
  新市區: { lng: 120.2927, lat: 23.0785 },
  安定區: { lng: 120.2371, lat: 23.1216 },
};

export const TAINAN_COASTAL: LngLat = { lng: 120.1506, lat: 22.9992 };

export const TAINAN_DISTRICT_NAMES = Object.keys(TAINAN_DISTRICT_CENTROIDS);

export function mentionsTainan(text: string): boolean {
  return TAINAN_CITY_LABELS.some((label) => text.includes(label));
}

export function firstTainanDistrict(text: string): string | null {
  for (const name of TAINAN_DISTRICT_NAMES) {
    if (text.includes(name)) return name;
  }
  return null;
}

export function locationForTainanAlert(
  text: string,
  kind: DisasterKind,
): { areaDesc: string; location: LngLat } {
  const district = firstTainanDistrict(text);
  if (district) {
    return {
      areaDesc: `臺南市${district}`,
      location: TAINAN_DISTRICT_CENTROIDS[district],
    };
  }
  if (kind === "typhoon" || kind === "strong-wind") {
    return { areaDesc: "臺南市沿海", location: TAINAN_COASTAL };
  }
  return { areaDesc: "臺南市", location: { ...TAINAN_CENTER } };
}
