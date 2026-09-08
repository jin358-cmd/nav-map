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
  address = address
    .replace(
      /[（(]\s*[．.·・•]?\s*(?:精確門牌|推估門牌位置|約略位置|巷弄位置|道路位置|地標位置)\s*[)）]/g,
      "",
    )
    .trim();
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

function restoreNotes(address: string, nearby: string) {
  return `${address}${nearby}`;
}

function stripAccuracyLabels(value: string) {
  let next = value.trim();
  next = next
    .replace(
      /[（(]\s*[．.·・•]?\s*(?:精確門牌|推估門牌位置|約略位置|巷弄位置|道路位置|地標位置)\s*[)）]/g,
      "",
    )
    .trim();
  for (const label of ACCURACY_SUFFIXES) {
    const suffix = ` · ${label}`;
    if (next.endsWith(suffix)) next = next.slice(0, -suffix.length).trim();
    next = next.replaceAll(suffix, "").trim();
    if (next.endsWith(label)) next = next.slice(0, -label.length).trim();
    next = next.replaceAll(label, "").trim();
  }
  return next.replace(/\s*[·・•．.]\s*$/g, "").trim();
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

function rebuildRoadFromParts(parts: ReturnType<typeof parseDisplayParts>) {
  return joinParts([
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

  const dropBare = /^(?:台灣|臺灣|Taiwan|ROC|\d{3,6})$/i;
  let city = "";
  let town = "";
  let road = "";
  let section = "";
  let poi = "";

  for (const token of tokens) {
    if (dropBare.test(token) || OSM_DROP_TOKEN.test(token)) continue;
    if (/[縣市]$/u.test(token) && token.length <= 4) {
      city = token;
      continue;
    }
    if (/[區鎮鄉]$/u.test(token) || (token.endsWith("市") && token !== city && token.length <= 4)) {
      if (!town) town = token;
      continue;
    }
    if (/(?:路|街|大道)$/u.test(token)) {
      if (!road) road = token;
      continue;
    }
    if (/^[0-9一二三四五六七八九十]+段$/u.test(token)) {
      section = token;
      continue;
    }
    if (/(?:巷|弄|號|樓|室)$/u.test(token)) {
      if (!road) road = token;
      else road += token;
      continue;
    }
    if (/[村里]$/u.test(token)) continue;
    if (!poi && !/[縣市區鄉鎮]$/u.test(token)) {
      poi = token.replace(/[（(][^）)]+[）)]/g, "").trim();
    }
  }

  const street = joinParts([city, town, road, section]);
  if (!street && !poi) {
    const kept = tokens.filter((token) => {
      if (dropBare.test(token) || OSM_DROP_TOKEN.test(token)) return false;
      if (/[區鄉鎮市縣]$/u.test(token)) return true;
      if (/(?:路|街|大道|道|段|巷|弄|號|樓|室)$/u.test(token)) return true;
      return false;
    });
    return kept.length ? kept.join("") : "";
  }
  if (poi && street) {
    const poiKey = poi.replaceAll("臺", "台").replaceAll(/\s+/g, "");
    const streetKey = street.replaceAll("臺", "台").replaceAll(/\s+/g, "");
    if (streetKey.includes(poiKey) || poiKey.includes(streetKey)) return street;
    return `${poi} · ${street}`;
  }
  return street || poi;
}

function formatDisplayAddressString(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return "";
  const { address, nearby } = peelNotes(trimmed);
  const commaForm = formatCommaSeparated(address);
  if (commaForm) return stripAccuracyLabels(restoreNotes(commaForm, nearby));

  const compact = compactTaiwanText(address);
  const parts = parseDisplayParts(compact);
  const rebuilt = rebuildFromParts(parts);
  if (parts.hadAdminUnit && rebuilt) {
    return stripAccuracyLabels(restoreNotes(rebuilt, nearby));
  }
  if (rebuilt && parts.road && compact.includes(parts.road)) {
    const looksLikeAdmin =
      /[村里]|(?:\d+|[一二三四五六七八九十]+)鄰/u.test(compact) &&
      rebuilt !== compact;
    if (looksLikeAdmin) return stripAccuracyLabels(restoreNotes(rebuilt, nearby));
  }
  return stripAccuracyLabels(restoreNotes(address, nearby));
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

export function sameTaiwanDisplayTitle(a?: string | null, b?: string | null) {
  const left = compactAddressKey(a);
  const right = compactAddressKey(b);
  return Boolean(left && right && left === right);
}

function compactAddressKey(value?: string | null) {
  return formatTaiwanDisplayAddress(value)
    .replaceAll("臺", "台")
    .replaceAll(/[()（）·・•,，、]/g, "")
    .replaceAll(/\s+/g, "");
}

/** 連鎖品牌分店名稱：店名＋分店，避免重複接上同一分店名。 */
export function formatChainStoreName(
  name?: string | null,
  branchName?: string | null,
): string {
  const title = (name ?? "").trim();
  const branch = (branchName ?? "").trim();
  if (!title) return branch;
  if (branch && !title.includes(branch)) return `${title} ${branch}`;
  return title;
}

/** 確認欄地址：行政區（區／鄉／鎮）＋完整路名，不含郵遞區號。 */
export function formatConfirmDistrictAddress(
  input?: string | TaiwanDisplayAddressInput | null,
): string {
  if (input == null) return "";
  if (typeof input === "object") {
    const rebuilt = joinStructured(input);
    if (rebuilt) return formatConfirmDistrictAddress(rebuilt);
    return input.fullAddress
      ? formatConfirmDistrictAddress(input.fullAddress)
      : "";
  }

  const trimmed = stripLeadingPostal(input.trim());
  if (!trimmed) return "";
  const { address, nearby } = peelNotes(trimmed);
  const compact = compactTaiwanText(stripLeadingPostal(address));
  const parts = parseDisplayParts(compact);
  const road = rebuildRoadFromParts(parts);
  const district = parts.town || "";
  const combined =
    district && road
      ? road.startsWith(district)
        ? road
        : `${district}${road}`
      : road || district;
  if (combined) return stripAccuracyLabels(restoreNotes(combined, nearby));
  return stripAccuracyLabels(
    formatTaiwanRoadName(input) || formatTaiwanDisplayAddress(input),
  );
}

/** 確認欄只顯示路名之後的完整地址，不含郵遞區號、縣市與行政區。 */
export function unifiedConfirmAddress(
  label?: string | null,
  address?: string | null,
): string {
  const district =
    formatConfirmDistrictAddress(address) ||
    formatConfirmDistrictAddress(label);
  if (district) return district;
  const road =
    formatTaiwanRoadName(address) || formatTaiwanRoadName(label);
  if (road) return stripAccuracyLabels(road);
  const fallback = formatTaiwanDisplayAddress(address || label);
  return stripAccuracyLabels(formatTaiwanRoadName(fallback) || fallback);
}

function formatCommaSeparatedRoad(value: string) {
  const tokens = value
    .split(",")
    .map((token) => token.trim())
    .filter(Boolean);
  if (tokens.length < 2) return "";

  const dropBare = /^(?:台灣|臺灣|Taiwan|ROC|\d{3,6})$/i;
  const kept: string[] = [];

  for (const token of tokens) {
    if (dropBare.test(token) || OSM_DROP_TOKEN.test(token)) continue;
    if (/[縣市]$/u.test(token) && token.length <= 4) continue;
    if (/[區鎮鄉]$/u.test(token) || (token.endsWith("市") && token.length <= 4)) {
      continue;
    }
    if (/[村里]$/u.test(token)) continue;
    if (/\b(?:District|City|County|Township|Village|Neighborhood)\b/i.test(token)) {
      continue;
    }
    if (
      /(?:路|街|大道|道|段|巷|弄|號|樓|室)$/u.test(token) ||
      /^(?:No\.?\s*)\d+/i.test(token) ||
      /\b(?:Road|Street|Rd\.?|St\.?|Ave\.?|Avenue|Section)\b/i.test(token)
    ) {
      kept.push(token);
    }
  }

  const english = kept.some((token) => /[A-Za-z]/.test(token));
  return kept.join(english ? " " : "");
}

function stripLeadingPostal(value: string) {
  return value.replace(/^\d{3,6}\s*/, "").trim();
}

/** 只保留路／街／段／巷／弄／號，省略郵遞區號與縣市區鄉鎮。 */
export function formatTaiwanRoadName(
  input: string | TaiwanDisplayAddressInput | null | undefined,
): string {
  if (input == null) return "";
  if (typeof input === "object") {
    const number = input.houseNumber || input.number || "";
    const road = joinParts([
      input.road,
      input.section,
      input.lane,
      input.alley,
      number,
      input.floor,
      input.room,
    ]);
    if (road) return road;
    return input.fullAddress ? formatTaiwanRoadName(input.fullAddress) : "";
  }

  const trimmed = stripLeadingPostal(input.trim());
  if (!trimmed) return "";
  const { address } = peelNotes(trimmed);
  const commaForm = formatCommaSeparatedRoad(address);
  if (commaForm) return commaForm;

  const compact = compactTaiwanText(stripLeadingPostal(address));
  const parts = parseDisplayParts(compact);
  const rebuilt = rebuildRoadFromParts(parts);
  if (!parts.city && !parts.town) {
    const stripped = stripLeadingPostal(compact);
    if (stripped && !/[縣市區鄉鎮]/.test(stripped)) {
      if (/口/.test(stripped) && (!rebuilt || stripped.startsWith(rebuilt))) {
        return stripped;
      }
      if (!rebuilt) return stripped;
    }
  }
  if (rebuilt) return rebuilt;

  let rest = compact;
  if (parts.city && rest.startsWith(parts.city)) rest = rest.slice(parts.city.length);
  if (parts.town && rest.startsWith(parts.town)) rest = rest.slice(parts.town.length);
  rest = rest.replace(VILLAGE_RE, "").replace(NEIGHBORHOOD_RE, "");
  return stripLeadingPostal(rest);
}

function rebuildStreetFromParts(parts: ReturnType<typeof parseDisplayParts>) {
  return joinParts([parts.road, parts.section]);
}

/** 停車場列表：只顯示路名＋段，不含縣市區與巷弄門牌。 */
export function formatTaiwanStreetName(
  input: string | TaiwanDisplayAddressInput | null | undefined,
): string {
  if (input == null) return "";
  if (typeof input === "object") {
    const street = joinParts([input.road, input.section]);
    if (street) return street;
    return input.fullAddress ? formatTaiwanStreetName(input.fullAddress) : "";
  }
  const roadForm = formatTaiwanRoadName(input);
  if (!roadForm) return "";
  const compact = compactTaiwanText(roadForm);
  const parts = parseDisplayParts(compact);
  const street = rebuildStreetFromParts(parts);
  if (street) return street;
  return compact
    .replace(/(\d+巷.*)$/u, "")
    .replace(/(\d+弄.*)$/u, "")
    .replace(/(\d+(?:之\d+)?號.*)$/u, "")
    .trim();
}

const COUNTY_CITY_ONLY = /^(?:[\u4e00-\u9fff]{1,3}[縣市])$/u;

/** 距離列：路名＋段，不含縣市、行政區、巷弄門牌。 */
export function formatDistanceRoadLabel(
  input: string | TaiwanDisplayAddressInput | null | undefined,
): string {
  const street = formatTaiwanStreetName(input);
  if (!street) return "";
  const compact = compactTaiwanText(street).replaceAll("臺", "台");
  if (COUNTY_CITY_ONLY.test(compact) || compact === "台灣" || compact === "台湾") {
    return "";
  }
  return street;
}

/** 路口：中華路 至 民生路 → 中華路 × 民生路 */
export function formatIntersectionLabel(value: string) {
  return value
    .replace(/\s*至\s*/g, " × ")
    .replace(/\s+到\s+(?=[\u4e00-\u9fff0-9].*(?:路|街|道|巷|線))/u, " × ")
    .replace(/\s{2,}/g, " ")
    .trim();
}
