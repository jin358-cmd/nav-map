export type ParsedTaiwanAddress = {
  city: string;
  town: string;
  road: string;
  section: string;
  lane: string;
  alley: string;
  number: string;
};

const ADDRESS_RE =
  /^(.+?[縣市])?(.+?[區市鎮鄉])?(.+?(?:路|街|大道|道))([0-9一二三四五六七八九十]+段)?(\d+巷)?(\d+弄)?(\d+(?:之\d+)?號)?$/u;

/** 本產品示範範圍；門牌沒寫縣市時補上，避免命中外縣市同名路。 */
export const DEFAULT_GEOCODE_CITY = "臺南市";

export function parseTaiwanAddress(query: string): ParsedTaiwanAddress | null {
  const compact = query.trim().replace(/\s+/g, "");
  const match = compact.match(ADDRESS_RE);
  if (!match?.[3]) return null;
  return {
    city: match[1] ?? "",
    town: match[2] ?? "",
    road: match[3] ?? "",
    section: match[4] ?? "",
    lane: match[5] ?? "",
    alley: match[6] ?? "",
    number: match[7] ?? "",
  };
}

function joinParts(...parts: string[]) {
  return parts.filter(Boolean).join("");
}

function withTaiVariants(value: string) {
  return Array.from(
    new Set([value, value.replaceAll("台", "臺"), value.replaceAll("臺", "台")]),
  ).filter((item) => item.length >= 2);
}

/**
 * OSM 幾乎沒有門牌號。完整「…32號」先查會得到空陣列，緊接著再查巷弄
 * 很容易被 Nominatim 限流，畫面就變成找不到地址。
 * 因此先查弄／巷／路，縣市缺省時補臺南市。
 */
export function expandTaiwanGeocodeQueries(query: string): string[] {
  const compact = query.trim().replace(/\s+/g, "");
  const ordered: string[] = [];
  const seen = new Set<string>();
  const pushOne = (value: string) => {
    const cleaned = value.replace(/,+$/g, "").trim();
    if (cleaned.length < 2 || seen.has(cleaned)) return;
    seen.add(cleaned);
    ordered.push(cleaned);
  };
  const push = (value: string) => {
    for (const variant of withTaiVariants(value)) pushOne(variant);
  };

  const parsed = parseTaiwanAddress(compact);
  if (!parsed) {
    pushOne(compact);
    if (!mentionsTainanCity(compact)) push(`${DEFAULT_GEOCODE_CITY}${compact}`);
    return ordered.slice(0, 4);
  }

  const city = parsed.city || DEFAULT_GEOCODE_CITY;
  const { town, road, section, lane, alley } = parsed;

  if (alley) {
    push(joinParts(city, town, road, section, lane, alley));
    push(joinParts(road, section, lane, alley));
  }
  if (lane) {
    push(joinParts(city, town, road, section, lane));
    push(joinParts(road, section, lane));
  }
  push(joinParts(city, town, road, section));
  if (parsed.city) push(joinParts(parsed.city, town, road, section));

  return ordered.slice(0, 5);
}

export function officialAddressQuery(query: string) {
  const compact = query.trim().replace(/\s+/g, "");
  const parsed = parseTaiwanAddress(compact);
  if (!parsed) return compact;
  if (parsed.city) return compact;
  return `${DEFAULT_GEOCODE_CITY}${compact}`;
}

export function describeRelaxedMatch(
  original: string,
  matchedQuery: string,
  osmName: string,
) {
  if (normalizeKey(original) === normalizeKey(matchedQuery)) {
    return osmName;
  }
  if (matchedQuery.includes("弄")) {
    return `已定位到${osmName || matchedQuery}（門牌未入圖，導航至弄口）`;
  }
  if (matchedQuery.includes("巷")) {
    return `已定位到${osmName || matchedQuery}（門牌未入圖，導航至巷口）`;
  }
  return `已定位到${osmName || matchedQuery}（門牌未入圖，導航至該路）`;
}

export function mentionsTainanCity(value: string) {
  return value.includes("臺南") || value.includes("台南");
}

function normalizeKey(value: string) {
  return value.replaceAll("臺", "台").replace(/\s+/g, "");
}
