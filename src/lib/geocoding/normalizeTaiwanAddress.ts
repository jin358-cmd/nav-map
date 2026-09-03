import { DEFAULT_GEOCODE_CITY } from "@/lib/taiwan-address";

export type TaiwanAddressParts = {
  city: string;
  town: string;
  village: string;
  road: string;
  section: string;
  lane: string;
  alley: string;
  number: string;
  subNumber: string;
  floor: string;
  room: string;
};

export type NormalizedTaiwanAddress = {
  original: string;
  compact: string;
  comparable: string;
  normalizedAddress: string;
  searchAddress: string;
  parts: TaiwanAddressParts;
  hasHouseNumber: boolean;
  hasLaneOrAlley: boolean;
  hasRoad: boolean;
};

export type RelaxedAddressQuery = {
  query: string;
  matchKind: "exact-house" | "approximate" | "lane-center" | "road-center" | "landmark";
};

const FULLWIDTH_DIGITS = /[０-９]/g;
const FLOOR_RE = /(?:地下|B)?\d+\s*(?:樓|F|f)(?:之\d+)?|[Bb]\d+|第?\d+層/u;
const ROOM_RE = /\d+\s*(?:室|房)/u;

function toHalfWidth(value: string) {
  return value.replace(FULLWIDTH_DIGITS, (digit) =>
    String.fromCharCode(digit.charCodeAt(0) - 0xfee0),
  );
}

export function compactTaiwanText(value: string) {
  return toHalfWidth(value)
    .replace(/[－–—]/g, "-")
    .replace(/[／/]/g, "")
    .replace(/\s+/g, "")
    .trim();
}

export function comparableTaiwanText(value: string) {
  return compactTaiwanText(value).replaceAll("臺", "台");
}

function stripFloorAndRoom(value: string) {
  return value.replace(FLOOR_RE, "").replace(ROOM_RE, "");
}

function normalizeHouseToken(value: string) {
  return value
    .replace(/(\d+)-(\d+)號/g, "$1之$2號")
    .replace(/(\d+)之(\d+)/g, "$1之$2");
}

function parseParts(compact: string): TaiwanAddressParts {
  const city = compact.match(/(.+?[縣市])/u)?.[1] ?? "";
  const restAfterCity = city ? compact.slice(city.length) : compact;
  const town = restAfterCity.match(/^(.+?[區市鎮鄉])/u)?.[1] ?? "";
  const restAfterTown = town ? restAfterCity.slice(town.length) : restAfterCity;
  const village = restAfterTown.match(/^(.+?[村里])/u)?.[1] ?? "";
  const rest = village ? restAfterTown.slice(village.length) : restAfterTown;

  const road = rest.match(/(.+?(?:路|街|大道|道))/u)?.[1] ?? "";
  const afterRoad = road ? rest.slice(road.length) : rest;
  const section = afterRoad.match(/^([0-9一二三四五六七八九十]+段)/u)?.[1] ?? "";
  const afterSection = section ? afterRoad.slice(section.length) : afterRoad;
  const lane = afterSection.match(/^(\d+巷)/u)?.[1] ?? "";
  const afterLane = lane ? afterSection.slice(lane.length) : afterSection;
  const alley = afterLane.match(/^(\d+弄)/u)?.[1] ?? "";
  const afterAlley = alley ? afterLane.slice(alley.length) : afterLane;
  const house = afterAlley.match(/^(\d+)(?:之(\d+))?(?:號)?/u);
  const floor = afterAlley.match(FLOOR_RE)?.[0] ?? "";
  const room = afterAlley.match(ROOM_RE)?.[0] ?? "";

  return {
    city,
    town,
    village,
    road,
    section,
    lane,
    alley,
    number: house?.[1] ?? "",
    subNumber: house?.[2] ?? "",
    floor,
    room,
  };
}

function joinParts(parts: Array<string | undefined>) {
  return parts.filter(Boolean).join("");
}

function houseToken(parts: TaiwanAddressParts) {
  if (!parts.number) return "";
  return parts.subNumber
    ? `${parts.number}之${parts.subNumber}號`
    : `${parts.number}號`;
}

export function normalizeTaiwanAddress(query: string): NormalizedTaiwanAddress {
  const original = query.trim();
  const compact = normalizeHouseToken(stripFloorAndRoom(compactTaiwanText(original)));
  const parts = parseParts(compact);
  if (!parts.city && (parts.road || parts.town)) {
    parts.city = DEFAULT_GEOCODE_CITY;
  }
  const searchAddress = joinParts([
    parts.city,
    parts.town,
    parts.village,
    parts.road,
    parts.section,
    parts.lane,
    parts.alley,
    houseToken(parts),
  ]);
  const normalizedAddress = searchAddress || compact || original;

  return {
    original,
    compact,
    comparable: comparableTaiwanText(normalizedAddress),
    normalizedAddress,
    searchAddress: searchAddress || compact,
    parts,
    hasHouseNumber: Boolean(parts.number),
    hasLaneOrAlley: Boolean(parts.lane || parts.alley),
    hasRoad: Boolean(parts.road),
  };
}

export function relaxedAddressQueries(
  parsed: NormalizedTaiwanAddress,
): RelaxedAddressQuery[] {
  const { parts, original, searchAddress } = parsed;
  const rows: RelaxedAddressQuery[] = [];
  const seen = new Set<string>();
  const push = (
    query: string,
    matchKind: RelaxedAddressQuery["matchKind"],
  ) => {
    const cleaned = query.trim();
    if (cleaned.length < 2 || seen.has(cleaned)) return;
    seen.add(cleaned);
    rows.push({ query: cleaned, matchKind });
  };

  if (parsed.hasHouseNumber) {
    push(searchAddress, "exact-house");
    push(
      joinParts([
        parts.city,
        parts.town,
        parts.road,
        parts.section,
        parts.lane,
        parts.alley,
        houseToken(parts),
      ]),
      "exact-house",
    );
  }
  if (parts.alley) {
    push(
      joinParts([parts.city, parts.town, parts.road, parts.section, parts.lane, parts.alley]),
      "lane-center",
    );
    push(joinParts([parts.road, parts.section, parts.lane, parts.alley]), "lane-center");
  }
  if (parts.lane) {
    push(
      joinParts([parts.city, parts.town, parts.road, parts.section, parts.lane]),
      "lane-center",
    );
    push(joinParts([parts.road, parts.section, parts.lane]), "lane-center");
  }
  if (parts.road) {
    push(joinParts([parts.city, parts.town, parts.road, parts.section]), "road-center");
    push(joinParts([parts.road, parts.section]), "road-center");
  }
  push(original, "landmark");
  return rows;
}

export function classifyMatchKind(
  query: NormalizedTaiwanAddress,
  candidateLabel: string,
  fallback: RelaxedAddressQuery["matchKind"] = "approximate",
): RelaxedAddressQuery["matchKind"] {
  const hay = comparableTaiwanText(candidateLabel);
  const house = houseToken(query.parts);
  if (house && hay.includes(comparableTaiwanText(house))) {
    if (
      (!query.parts.lane || hay.includes(query.parts.lane)) &&
      (!query.parts.alley || hay.includes(query.parts.alley))
    ) {
      return "exact-house";
    }
    return "approximate";
  }
  if (query.parts.alley && hay.includes(query.parts.alley)) return "lane-center";
  if (query.parts.lane && hay.includes(query.parts.lane)) return "lane-center";
  if (query.parts.road && hay.includes(comparableTaiwanText(query.parts.road))) {
    return "road-center";
  }
  return fallback;
}

export function matchKindLabel(kind: RelaxedAddressQuery["matchKind"]) {
  if (kind === "exact-house") return "精確門牌";
  if (kind === "lane-center") return "巷弄中心點";
  if (kind === "road-center") return "道路中心點";
  if (kind === "landmark") return "地標位置";
  return "約略位置";
}

export function queryHash(normalizedQuery: string, biasKey = "") {
  const raw = `${comparableTaiwanText(normalizedQuery)}|${biasKey}`;
  let hash = 2166136261;
  for (let index = 0; index < raw.length; index += 1) {
    hash ^= raw.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `q${(hash >>> 0).toString(16)}`;
}
