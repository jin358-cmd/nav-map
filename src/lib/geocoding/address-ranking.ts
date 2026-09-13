import {
  comparableTaiwanText,
  houseToken,
  matchKindLabel,
  normalizeTaiwanAddress,
  type NormalizedTaiwanAddress,
} from "./normalizeTaiwanAddress";
import type { GeocodeMatchKind, GeocodeResult, GeocodeSource } from "./types";

export type ResultGroup = "exact-house" | "interpolated" | "nearby" | "poi";
export type RegionValidation = "ok" | "mismatch" | "unavailable";

export type RankedGeocodeResult = GeocodeResult & {
  rankScore: number;
  resultGroup: ResultGroup;
  accuracyLabel: string;
  regionValidation: RegionValidation;
  originalSource?: GeocodeSource;
};

const SOUTH_BOXES: Record<string, { south: number; north: number; west: number; east: number }> = {
  雲林縣: { south: 23.45, north: 23.92, west: 120.02, east: 120.82 },
  嘉義市: { south: 23.43, north: 23.54, west: 120.39, east: 120.51 },
  嘉義縣: { south: 23.12, north: 23.66, west: 120.08, east: 120.88 },
  臺南市: { south: 22.8, north: 23.46, west: 119.92, east: 120.72 },
  高雄市: { south: 22.28, north: 23.32, west: 120.1, east: 121.05 },
  屏東縣: { south: 21.7, north: 22.95, west: 120.28, east: 120.98 },
};

function haystack(item: GeocodeResult) {
  return comparableTaiwanText(`${item.label} ${item.formattedAddress}`);
}

function sameToken(left?: string, right?: string) {
  if (!left || !right) return false;
  return comparableTaiwanText(left) === comparableTaiwanText(right);
}

function containsToken(hay: string, token?: string) {
  if (!token) return false;
  return hay.includes(comparableTaiwanText(token));
}

export function validateRegion(
  parsed: NormalizedTaiwanAddress,
  item: GeocodeResult,
): RegionValidation {
  const county = parsed.parts.city;
  if (!county) return "unavailable";
  const box = SOUTH_BOXES[county];
  const hay = haystack(item);
  const textMatch = containsToken(hay, county);
  if (box) {
    const inBox =
      item.latitude >= box.south &&
      item.latitude <= box.north &&
      item.longitude >= box.west &&
      item.longitude <= box.east;
    if (!inBox && !textMatch) return "mismatch";
    if (textMatch || inBox) return "ok";
  }
  if (textMatch) return "ok";
  if (/[縣市]/.test(hay) && !textMatch) return "mismatch";
  return box ? "ok" : "unavailable";
}

export function scoreAddressCandidate(
  parsed: NormalizedTaiwanAddress,
  item: GeocodeResult,
): { score: number; regionValidation: RegionValidation } {
  const hay = haystack(item);
  const regionValidation = validateRegion(parsed, item);
  let score = 0;
  const house = houseToken(parsed.parts);
  const candidateHouse = hay.match(/(\d+)(?:之(\d+))?號/u);
  if (
    house &&
    candidateHouse &&
    candidateHouse[1] === parsed.parts.number &&
    (candidateHouse[2] ?? "") === parsed.parts.subNumber
  ) {
    score += 40;
  } else if (parsed.hasHouseNumber && !candidateHouse) {
    score -= 35;
  }
  if (parsed.hasRoad && containsToken(hay, parsed.parts.road)) score += 20;
  if (parsed.parts.section && containsToken(hay, parsed.parts.section)) score += 10;
  if (parsed.parts.lane && containsToken(hay, parsed.parts.lane)) score += 8;
  if (parsed.parts.alley && containsToken(hay, parsed.parts.alley)) score += 8;
  if (parsed.parts.city && containsToken(hay, parsed.parts.city)) score += 10;
  if (parsed.parts.town && containsToken(hay, parsed.parts.town)) score += 12;
  if (
    (parsed.parts.village && containsToken(hay, parsed.parts.village)) ||
    (parsed.parts.neighborhood && containsToken(hay, parsed.parts.neighborhood)) ||
    (parsed.parts.locality && containsToken(hay, parsed.parts.locality))
  ) {
    score += 5;
  }
  if (item.source === "index" && item.matchKind === "exact-house") score += 10;
  if (item.matchKind === "road-center") score -= 25;
  if (item.source === "osm") score -= 15;
  if (regionValidation === "mismatch") score -= 80;
  if (item.source === "cache") score += 0;
  return { score, regionValidation };
}

export function isTrueExactHouse(
  parsed: NormalizedTaiwanAddress,
  item: GeocodeResult,
  regionValidation: RegionValidation,
) {
  if (regionValidation === "mismatch") return false;
  if (item.matchKind === "road-center" || item.matchKind === "lane-center") return false;
  if (item.matchKind === "landmark" || item.matchKind === "approximate") return false;
  const hay = haystack(item);
  if (!parsed.hasHouseNumber) return false;
  const house = houseToken(parsed.parts);
  if (!containsToken(hay, house.replace(/附\d+$/, ""))) return false;
  if (parsed.parts.lane && !containsToken(hay, parsed.parts.lane)) return false;
  if (parsed.parts.alley && !containsToken(hay, parsed.parts.alley)) return false;
  return item.matchKind === "exact-house" || Boolean(item.exactHouseNumber);
}

export function resultGroupFor(
  item: GeocodeResult,
  exact: boolean,
): ResultGroup {
  if (item.matchKind === "landmark" || item.source === "local" || item.source === "overture") {
    if (item.category || item.matchKind === "landmark") return "poi";
  }
  if (exact) return "exact-house";
  if (item.matchKind === "interpolated") return "interpolated";
  if (
    item.matchKind === "lane-center" ||
    item.matchKind === "road-center" ||
    item.matchKind === "approximate"
  ) {
    return "nearby";
  }
  return item.category ? "poi" : "nearby";
}

export function rankAddressResults(
  rows: GeocodeResult[],
  query: string,
  origin?: { lat: number; lng: number },
): RankedGeocodeResult[] {
  const parsed = normalizeTaiwanAddress(query);
  return rows
    .map((item) => {
      const { score, regionValidation } = scoreAddressCandidate(parsed, item);
      const exact = isTrueExactHouse(parsed, item, regionValidation);
      const matchKind: GeocodeMatchKind = exact
        ? "exact-house"
        : item.matchKind === "exact-house"
          ? "interpolated"
          : item.matchKind;
      const group = resultGroupFor({ ...item, matchKind }, exact);
      const distanceTie =
        origin && Number.isFinite(item.latitude)
          ? Math.round(
              Math.hypot(
                (item.latitude - origin.lat) * 111000,
                (item.longitude - origin.lng) * 111000 * Math.cos((origin.lat * Math.PI) / 180),
              ),
            )
          : item.distanceMeters ?? 0;
      return {
        ...item,
        matchKind,
        exactHouseNumber: exact,
        rankScore: score,
        resultGroup: group,
        accuracyLabel: matchKindLabel(matchKind),
        regionValidation,
        originalSource: item.source === "cache" ? item.source : item.source,
        distanceMeters: item.distanceMeters ?? distanceTie,
      };
    })
    .sort((a, b) => {
      if (a.regionValidation === "mismatch" && b.regionValidation !== "mismatch") return 1;
      if (b.regionValidation === "mismatch" && a.regionValidation !== "mismatch") return -1;
      if (a.exactHouseNumber !== b.exactHouseNumber) return a.exactHouseNumber ? -1 : 1;
      if (a.rankScore !== b.rankScore) return b.rankScore - a.rankScore;
      const kindWeight =
        Number(a.matchKind === "exact-house") - Number(b.matchKind === "exact-house");
      if (kindWeight !== 0) return -kindWeight;
      if ((a.distanceMeters ?? 0) !== (b.distanceMeters ?? 0)) {
        return (a.distanceMeters ?? 0) - (b.distanceMeters ?? 0);
      }
      return b.confidence - a.confidence;
    });
}

export function groupSearchResults(rows: RankedGeocodeResult[]) {
  const groups: Record<ResultGroup, RankedGeocodeResult[]> = {
    "exact-house": [],
    interpolated: [],
    nearby: [],
    poi: [],
  };
  for (const row of rows) {
    groups[row.resultGroup].push(row);
  }
  return groups;
}

export function sameAddress(a: GeocodeResult, b: GeocodeResult) {
  const keyA = comparableTaiwanText(`${a.label}|${a.formattedAddress}`);
  const keyB = comparableTaiwanText(`${b.label}|${b.formattedAddress}`);
  if (keyA && keyA === keyB) return true;
  const meters =
    Math.hypot((a.latitude - b.latitude) * 111000, (a.longitude - b.longitude) * 111000) ;
  return meters <= 25 && sameToken(a.label.slice(0, 8), b.label.slice(0, 8));
}
