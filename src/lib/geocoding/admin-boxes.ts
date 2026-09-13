import boxes from "@/data/taiwan-admin-boxes.json";

export type AdminBox = {
  south: number;
  north: number;
  west: number;
  east: number;
  source?: string;
};

export type RegionValidation = "ok" | "mismatch" | "unavailable";

function officialCounty(value?: string) {
  return String(value || "")
    .replace(/\s+/g, "")
    .replaceAll("台北", "臺北")
    .replaceAll("台中", "臺中")
    .replaceAll("台南", "臺南")
    .replaceAll("台東", "臺東");
}

export function countyBox(county?: string): AdminBox | null {
  const key = officialCounty(county);
  const row = (boxes.counties as Record<string, AdminBox | undefined>)[key];
  return row ?? null;
}

export function districtBox(county?: string, district?: string): AdminBox | null {
  const city = officialCounty(county);
  const town = officialCounty(district);
  if (!city || !town) return null;
  const group = (boxes.districts as Record<string, Record<string, AdminBox | undefined>>)[city];
  return group?.[town] ?? null;
}

export function hasCountyBox(county?: string) {
  return Boolean(countyBox(county));
}

export function pointInBox(lat: number, lng: number, box: AdminBox) {
  return lat >= box.south && lat <= box.north && lng >= box.west && lng <= box.east;
}

/**
 * County envelopes for all 22 counties. District envelopes are derived /
 * seeded — they never hard-reject a point that is still inside the county.
 */
export function validateAdminPoint(
  county: string | undefined,
  district: string | undefined,
  lat: number,
  lng: number,
): { region: RegionValidation; districtInside: boolean } {
  if (!county) return { region: "unavailable", districtInside: false };
  const box = countyBox(county);
  if (!box) return { region: "unavailable", districtInside: false };
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return { region: "unavailable", districtInside: false };
  }
  const inCounty = pointInBox(lat, lng, box);
  const townBox = districtBox(county, district);
  const districtInside = Boolean(townBox && pointInBox(lat, lng, townBox));
  if (!inCounty) return { region: "mismatch", districtInside: false };
  return { region: "ok", districtInside };
}

export function adminBoxMeta() {
  return {
    version: boxes.version,
    kind: boxes.kind,
    notOfficialPolygons: boxes.notOfficialPolygons,
    countyCount: Object.keys(boxes.counties).length,
    districtCount: Object.values(boxes.districts).reduce(
      (sum, group) => sum + Object.keys(group).length,
      0,
    ),
  };
}
