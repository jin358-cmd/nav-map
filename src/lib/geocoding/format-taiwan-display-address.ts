import { compactTaiwanText } from "@/lib/geocoding/normalizeTaiwanAddress";

export type TaiwanDisplayAddressInput = {
  county?: string | null;
  city?: string | null;
  district?: string | null;
  town?: string | null;
  village?: string | null;
  neighborhood?: string | null;
  road?: string | null;
  section?: string | null;
  lane?: string | null;
  alley?: string | null;
  houseNumber?: string | null;
  number?: string | null;
  floor?: string | null;
  room?: string | null;
  fullAddress?: string | null;
};

const FLOOR_RE = /(?:地下|B)?\d+\s*(?:樓|F|f)(?:之\d+)?|[Bb]\d+|第?\d+層/u;
const ROOM_RE = /\d+\s*(?:室|房)/u;
const NEIGHBORHOOD_RE = /^(?:\d+|[一二三四五六七八九十]+)鄰/u;
const VILLAGE_RE =
  /^([\u4e00-\u9fff]{2,4}[村里])(?=(?:\d+|[一二三四五六七八九十]+)鄰|[\u4e00-\u9fff]{2,8}(?:路|街|大道|道)|$)/u;
const ACCURACY_SUFFIXES = [
  "精確門牌",
  "推估門牌位置",
  "約略位置",
  "巷弄位置",
  "道路位置",
  "地標位置",
];
const OSM_DROP_TOKEN =
  /^(?:[\u4e00-\u9fff]{2,8}[村里]|(?:\d+|[一二三四五六七八九十]+)鄰|.+\s+Village|.+\s+Neighborhood)$/i;

function joinParts(parts: Array<string | null | undefined>) {
  return parts.filter((part): part is string => Boolean(part && part.trim())).join("");
}

function houseToken(number: string, subNumber = "") {
  if (!number) return "";
  return subNumber ? `${number}之${subNumber}號` : `${number}號`;
}

function peelNotes(value: string) {
  let address = value.trim();
  const notes: string[] = [];
  for (const label of ACCURACY_SUFFIXES) {
    const suffix = ` · ${label}`;
    if (address.endsWith(suffix)) {
      address = address.slice(0, -suffix.length).trim();
      notes.push(suffix);
    }
  }
  let nearby = "";
  if (address.endsWith("附近")) {
    address = address.slice(0, -2);
    nearby = "附近";
  }
  return { address, nearby, notes };
}

function restoreNotes(address: string, nearby: string, notes: string[]) {
  return `${address}${nearby}${notes.join("")}`;
}

function parseDisplayParts(compact: string) {
  const city = compact.match(/(.+?[縣市])/u)?.[1] ?? "";
  const afterCity = city ? compact.slice(city.length) : compact;
  const town = afterCity.match(/^(.+?[區市鎮鄉])/u)?.[1] ?? "";
  let rest = town ? afterCity.slice(town.length) : afterCity;
  const village = rest.match(VILLAGE_RE)?.[1] ?? "";
  if (village) rest = rest.slice(village.length);
  const neighborhood = rest.match(NEIGHBORHOOD_RE)?.[0] ?? "";
  if (neighborhood) rest = rest.slice(neighborhood.length);

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
    road,
    section,
    lane,
    alley,
    number: house?.[1] ?? "",
    subNumber: house?.[2] ?? "",
    floor,
    room,
    hadAdminUnit: Boolean(village || neighborhood),
  };
}

function rebuildFromParts(parts: ReturnType<typeof parseDisplayParts>) {
  return joinParts([
    parts.city,
    parts.town,
    parts.road,
    parts.section,
    parts.lane,
    parts.alley,
    houseToken(parts.number, parts.subNumber),
    parts.floor,
    parts.room,
  ]);
}

function formatCommaSeparated(value: string) {
  const tokens = value
    .split(",")
    .map((token) => token.trim())
    .filter(Boolean);
  if (tokens.length < 2) return "";
  const kept = tokens.filter((token) => {
    if (/[區鄉鎮市縣]$/u.test(token)) return true;
    if (/(?:路|街|大道|道|段|巷|弄|號|樓|室)$/u.test(token)) return true;
    return !OSM_DROP_TOKEN.test(token);
  });
  if (kept.length === tokens.length) return "";
  return kept.join(", ");
}

function formatDisplayAddressString(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return "";
  const { address, nearby, notes } = peelNotes(trimmed);
  const commaForm = formatCommaSeparated(address);
  if (commaForm) return restoreNotes(commaForm, nearby, notes);

  const compact = compactTaiwanText(address);
  const parts = parseDisplayParts(compact);
  const rebuilt = rebuildFromParts(parts);
  if (parts.hadAdminUnit && rebuilt) {
    return restoreNotes(rebuilt, nearby, notes);
  }
  if (rebuilt && parts.road && compact.includes(parts.road)) {
    const looksLikeAdmin =
      /[村里]|(?:\d+|[一二三四五六七八九十]+)鄰/u.test(compact) &&
      rebuilt !== compact;
    if (looksLikeAdmin) return restoreNotes(rebuilt, nearby, notes);
  }
  return restoreNotes(address, nearby, notes);
}

function joinStructured(input: TaiwanDisplayAddressInput) {
  const city = input.city || input.county || "";
  const town = input.town || input.district || "";
  const number = input.houseNumber || input.number || "";
  return joinParts([
    city,
    town,
    input.road,
    input.section,
    input.lane,
    input.alley,
    number,
    input.floor,
    input.room,
  ]);
}

export function formatTaiwanDisplayAddress(
  input: string | TaiwanDisplayAddressInput | null | undefined,
): string {
  if (input == null) return "";
  if (typeof input === "object") {
    const rebuilt = joinStructured(input);
    if (rebuilt) return rebuilt;
    return input.fullAddress ? formatDisplayAddressString(input.fullAddress) : "";
  }
  return formatDisplayAddressString(input);
}
