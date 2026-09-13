import type { GeocodeMatchKind } from "./types";

export type TaiwanAddressParts = {
  city: string;
  town: string;
  county: string;
  district: string;
  village: string;
  neighborhood: string;
  locality: string;
  road: string;
  section: string;
  lane: string;
  alley: string;
  number: string;
  subNumber: string;
  attachedNumber: string;
  floor: string;
  room: string;
  postalCode: string;
};

export type NormalizedTaiwanAddress = {
  original: string;
  compact: string;
  comparable: string;
  normalizedAddress: string;
  searchAddress: string;
  canonicalKey: string;
  parts: TaiwanAddressParts;
  hasHouseNumber: boolean;
  hasLaneOrAlley: boolean;
  hasRoad: boolean;
  hasAdmin: boolean;
};

export type RelaxedAddressQuery = {
  query: string;
  matchKind: GeocodeMatchKind;
};

export const ACCURACY_LABELS: Record<GeocodeMatchKind, string> = {
  "exact-house": "精確門牌",
  interpolated: "推估門牌位置",
  approximate: "約略位置",
  "lane-center": "巷弄位置",
  "road-center": "道路位置",
  landmark: "地標位置",
};

const FULLWIDTH_DIGITS = /[０-９]/g;
const FLOOR_RE = /(?:地下|B)?\d+\s*(?:樓|F|f)(?:之\d+)?|[Bb]\d+|第?\d+層|[一二三四五六七八九十]+樓/u;
const ROOM_RE = /\d+\s*(?:室|房)/u;
const COUNTY_RE =
  /^(臺北市|台北市|新北市|桃園市|臺中市|台中市|臺南市|台南市|高雄市|基隆市|新竹市|新竹縣|苗栗縣|彰化縣|南投縣|雲林縣|嘉義市|嘉義縣|屏東縣|宜蘭縣|花蓮縣|臺東縣|台東縣|澎湖縣|金門縣|連江縣)/u;

function toHalfWidth(value: string) {
  return value
    .replace(FULLWIDTH_DIGITS, (digit) => String.fromCharCode(digit.charCodeAt(0) - 0xfee0))
    .replace(/[Ａ-Ｚ]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0xfee0))
    .replace(/[ａ-ｚ]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0xfee0));
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

export function officialTaiwanText(value: string) {
  return compactTaiwanText(value)
    .replaceAll("台北", "臺北")
    .replaceAll("台中", "臺中")
    .replaceAll("台南", "臺南")
    .replaceAll("台東", "臺東");
}

function chineseToNumber(value: string) {
  if (!value) return "";
  if (/^\d+$/.test(value)) return value;
  const digits: Record<string, number> = {
    零: 0,
    〇: 0,
    一: 1,
    二: 2,
    兩: 2,
    三: 3,
    四: 4,
    五: 5,
    六: 6,
    七: 7,
    八: 8,
    九: 9,
  };
  if (value === "十") return "10";
  if (/^[零〇一二兩三四五六七八九]+$/.test(value) && !value.includes("十")) {
    return value
      .split("")
      .map((ch) => String(digits[ch] ?? ""))
      .join("");
  }
  let total = 0;
  let last = 0;
  for (const ch of value) {
    if (ch === "十") {
      total += (last || 1) * 10;
      last = 0;
    } else if (digits[ch] != null) {
      last = digits[ch];
    }
  }
  return String(total + last || value);
}

function normalizeUnitNumber(value: string, unit: string) {
  const match = value.match(new RegExp(`^([0-9一二兩三四五六七八九十]+)(${unit})$`, "u"));
  if (!match) return value;
  return `${chineseToNumber(match[1])}${unit}`;
}

function stripFloorAndRoom(value: string) {
  return value.replace(FLOOR_RE, "").replace(ROOM_RE, "");
}

function normalizeHouseToken(value: string) {
  return value
    .replace(/(\d+)號之(\d+)/g, "$1之$2號")
    .replace(/(\d+)-(\d+)號/g, "$1之$2號")
    .replace(/(\d+)之(\d+)/g, "$1之$2");
}

function stripPostal(value: string) {
  return value.replace(/^\d{3,6}/, "");
}

function stripDuplicateAdmin(value: string) {
  return value.replace(
    /((?:[\u4e00-\u9fff]{1,3}[縣市])(?:[\u4e00-\u9fff]{1,4}[區市鎮鄉])?)\1/u,
    "$1",
  );
}

function emptyParts(): TaiwanAddressParts {
  return {
    city: "",
    town: "",
    county: "",
    district: "",
    village: "",
    neighborhood: "",
    locality: "",
    road: "",
    section: "",
    lane: "",
    alley: "",
    number: "",
    subNumber: "",
    attachedNumber: "",
    floor: "",
    room: "",
    postalCode: "",
  };
}

function parseParts(compact: string, originalCompact: string): TaiwanAddressParts {
  const parts = emptyParts();
  const postal = originalCompact.match(/^\d{3,6}/)?.[0] ?? "";
  parts.postalCode = postal;
  let rest = compact;

  const county = rest.match(COUNTY_RE)?.[1] ?? rest.match(/(.+?[縣市])/u)?.[1] ?? "";
  if (county) {
    parts.county = officialTaiwanText(county);
    parts.city = parts.county;
    rest = rest.slice(county.length);
  }

  const district =
    rest.match(/^([\u4e00-\u9fff]{1,8}區)/u)?.[1] ??
    rest.match(/^([\u4e00-\u9fff]{1,8}市)/u)?.[1] ??
    rest.match(/^([\u4e00-\u9fff]{1,8}[鎮鄉])/u)?.[1] ??
    "";
  if (district && district !== "市") {
    parts.district = officialTaiwanText(district);
    parts.town = parts.district;
    rest = rest.slice(district.length);
  }

  const village = rest.match(/^([\u4e00-\u9fff]{1,6}[村里])/u)?.[1] ?? "";
  if (village) {
    parts.village = village;
    rest = rest.slice(village.length);
  }

  const neighborhood = rest.match(/^((?:\d+|[一二三四五六七八九十]+)鄰)/u)?.[1] ?? "";
  if (neighborhood) {
    parts.neighborhood = normalizeUnitNumber(neighborhood, "鄰");
    rest = rest.slice(neighborhood.length);
  }

  const locality = rest.match(/^([\u4e00-\u9fff]{1,8}(?:庄|莊|部落|聚落))/u)?.[1] ?? "";
  if (locality) {
    parts.locality = locality.replace("莊", "庄");
    rest = rest.slice(locality.length);
  }

  const road = rest.match(/(.+?(?:路|街|大道|道))/u)?.[1] ?? "";
  if (road) {
    parts.road = road;
    rest = rest.slice(road.length);
  }

  const section = rest.match(/^((?:\d+|[一二三四五六七八九十]+)段)/u)?.[1] ?? "";
  if (section) {
    parts.section = normalizeUnitNumber(section, "段");
    rest = rest.slice(section.length);
  }

  const lane = rest.match(/^((?:\d+|[一二三四五六七八九十]+)巷)/u)?.[1] ?? "";
  if (lane) {
    parts.lane = normalizeUnitNumber(lane, "巷");
    rest = rest.slice(lane.length);
  }

  const alley = rest.match(/^((?:\d+|[一二三四五六七八九十]+)弄)/u)?.[1] ?? "";
  if (alley) {
    parts.alley = normalizeUnitNumber(alley, "弄");
    rest = rest.slice(alley.length);
  }

  const attached = rest.match(/附\s*(\d+)/u);
  if (attached) {
    parts.attachedNumber = attached[1];
    rest = rest.replace(/附\s*\d+/u, "");
  }

  const floor = originalCompact.match(FLOOR_RE)?.[0] ?? "";
  const room = originalCompact.match(ROOM_RE)?.[0] ?? "";
  parts.floor = floor;
  parts.room = room;

  const house =
    rest.match(/^(\d+)(?:之(\d+))?(?:號)?/u) ??
    compact.match(/(\d+)(?:之(\d+))?號/u);
  if (house) {
    parts.number = house[1] ?? "";
    parts.subNumber = house[2] ?? "";
  }

  return parts;
}

function joinParts(parts: Array<string | undefined>) {
  return parts.filter(Boolean).join("");
}

export function houseToken(parts: Pick<TaiwanAddressParts, "number" | "subNumber" | "attachedNumber">) {
  if (!parts.number) return "";
  const base = parts.subNumber ? `${parts.number}之${parts.subNumber}號` : `${parts.number}號`;
  return parts.attachedNumber ? `${base}附${parts.attachedNumber}` : base;
}

export function canonicalAddressKey(parts: TaiwanAddressParts) {
  return [
    officialTaiwanText(parts.county || parts.city),
    officialTaiwanText(parts.district || parts.town),
    parts.village,
    parts.neighborhood,
    parts.locality,
    parts.road,
    parts.section,
    parts.lane,
    parts.alley,
    parts.number,
    parts.subNumber,
    parts.attachedNumber,
  ]
    .map((value) => comparableTaiwanText(value || ""))
    .join("|");
}

export function normalizeTaiwanAddress(query: string): NormalizedTaiwanAddress {
  const original = query.trim();
  const rawCompact = compactTaiwanText(original);
  const compact = normalizeHouseToken(
    stripFloorAndRoom(stripDuplicateAdmin(stripPostal(officialTaiwanText(rawCompact)))),
  );
  const parts = parseParts(compact, rawCompact);
  const searchAddress = joinParts([
    parts.city,
    parts.town,
    parts.village,
    parts.neighborhood,
    parts.locality,
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
    canonicalKey: canonicalAddressKey(parts),
    parts,
    hasHouseNumber: Boolean(parts.number),
    hasLaneOrAlley: Boolean(parts.lane || parts.alley),
    hasRoad: Boolean(parts.road),
    hasAdmin: Boolean(parts.city || parts.town || parts.village),
  };
}

export function relaxedAddressQueries(
  parsed: NormalizedTaiwanAddress,
): RelaxedAddressQuery[] {
  const { parts, original, searchAddress } = parsed;
  const rows: RelaxedAddressQuery[] = [];
  const seen = new Set<string>();
  const push = (query: string, matchKind: RelaxedAddressQuery["matchKind"]) => {
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
        parts.village,
        parts.neighborhood,
        parts.locality,
        parts.road,
        parts.section,
        parts.lane,
        parts.alley,
        houseToken({ number: parts.number, subNumber: parts.subNumber, attachedNumber: "" }),
      ]),
      "exact-house",
    );
  }
  if (parts.village && parts.neighborhood && parts.number) {
    push(
      joinParts([parts.city, parts.town, parts.village, parts.neighborhood, houseToken(parts)]),
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
    push(joinParts([parts.city, parts.town, parts.road, parts.section, parts.lane]), "lane-center");
    push(joinParts([parts.road, parts.section, parts.lane]), "lane-center");
  }
  if (parts.road) {
    push(joinParts([parts.city, parts.town, parts.road, parts.section]), "road-center");
    push(joinParts([parts.road, parts.section]), "road-center");
  }
  push(original, "landmark");
  return rows;
}

export function isInterpolationHint(value: string) {
  return /內插|interpolation|interpolat|range\s*interpol/i.test(value);
}

function extractHouseToken(value: string) {
  const match = comparableTaiwanText(value).match(/(\d+)(?:之(\d+))?號(?:附(\d+))?/u);
  if (!match) return null;
  return {
    number: match[1] ?? "",
    subNumber: match[2] ?? "",
    attachedNumber: match[3] ?? "",
    token: match[2] ? `${match[1]}之${match[2]}號` : `${match[1]}號`,
  };
}

export function classifyMatchKind(
  query: NormalizedTaiwanAddress,
  candidateLabel: string,
  fallback: GeocodeMatchKind = "approximate",
  providerHint = "",
): GeocodeMatchKind {
  if (providerHint && isInterpolationHint(providerHint)) {
    return "interpolated";
  }
  const hay = comparableTaiwanText(candidateLabel);
  const queryCounty = comparableTaiwanText(query.parts.city);
  if (queryCounty && /[縣市]$/.test(queryCounty)) {
    const candidateCounty = hay.match(
      /(台北市|臺北市|新北市|桃園市|台中市|臺中市|台南市|臺南市|高雄市|基隆市|新竹市|新竹縣|苗栗縣|彰化縣|南投縣|雲林縣|嘉義市|嘉義縣|屏東縣|宜蘭縣|花蓮縣|台東縣|臺東縣|澎湖縣|金門縣|連江縣)/,
    )?.[1];
    if (
      candidateCounty &&
      comparableTaiwanText(candidateCounty) !== queryCounty &&
      comparableTaiwanText(candidateCounty).replaceAll("台", "臺") !==
        queryCounty.replaceAll("台", "臺")
    ) {
      return fallback === "exact-house" ? "approximate" : fallback;
    }
  }
  const house = houseToken(query.parts);
  const candidateHouse = extractHouseToken(candidateLabel);
  const houseMatches =
    Boolean(house) &&
    candidateHouse &&
    candidateHouse.number === query.parts.number &&
    candidateHouse.subNumber === query.parts.subNumber;
  if (houseMatches) {
    if (
      (!query.parts.lane || hay.includes(comparableTaiwanText(query.parts.lane))) &&
      (!query.parts.alley || hay.includes(comparableTaiwanText(query.parts.alley))) &&
      (!query.parts.road ||
        !query.hasRoad ||
        hay.includes(comparableTaiwanText(query.parts.road)))
    ) {
      return "exact-house";
    }
    return "interpolated";
  }
  if (
    house &&
    candidateHouse &&
    (candidateHouse.number !== query.parts.number ||
      candidateHouse.subNumber !== query.parts.subNumber) &&
    query.parts.road &&
    hay.includes(comparableTaiwanText(query.parts.road))
  ) {
    return "interpolated";
  }
  if (query.parts.alley && hay.includes(comparableTaiwanText(query.parts.alley))) {
    return "lane-center";
  }
  if (query.parts.lane && hay.includes(comparableTaiwanText(query.parts.lane))) {
    return "lane-center";
  }
  if (query.parts.road && hay.includes(comparableTaiwanText(query.parts.road))) {
    return "road-center";
  }
  return fallback;
}

export function matchKindLabel(kind: GeocodeMatchKind) {
  return ACCURACY_LABELS[kind] ?? ACCURACY_LABELS.approximate;
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
