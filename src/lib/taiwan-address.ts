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
 * Most-specific first. House numbers are often missing from OSM,
 * so 巷／街 fallbacks are required for typical Taiwan addresses.
 */
export function expandTaiwanGeocodeQueries(query: string): string[] {
  const compact = query.trim().replace(/\s+/g, "");
  const ordered: string[] = [];
  const seen = new Set<string>();
  const pushOne = (value: string) => {
    if (value.length < 2 || seen.has(value)) return;
    seen.add(value);
    ordered.push(value);
  };
  const push = (value: string) => {
    for (const variant of withTaiVariants(value)) pushOne(variant);
  };

  pushOne(compact);

  const parsed = parseTaiwanAddress(compact);
  if (parsed) {
    const { city, town, road, section, lane, alley } = parsed;
    push(joinParts(city, town, road, section, lane, alley));
    push(joinParts(town, road, section, lane));
    push(joinParts(city, town, road, section));
    push(`${joinParts(road, section, lane)},${joinParts(city, town)}`);
  }

  return ordered.slice(0, 6);
}

export function describeRelaxedMatch(
  original: string,
  matchedQuery: string,
  osmName: string,
) {
  if (normalizeKey(original) === normalizeKey(matchedQuery)) {
    return osmName;
  }
  if (matchedQuery.includes("巷") || matchedQuery.includes("弄")) {
    return `已定位到${osmName || matchedQuery}（門牌未入圖，導航至巷口）`;
  }
  return `已定位到${osmName || matchedQuery}（門牌未入圖，導航至該路）`;
}

function normalizeKey(value: string) {
  return value.replaceAll("臺", "台").replace(/\s+/g, "");
}
