/**
 * GCIS → NLSC 地址正規化與配對品質（A–E）。
 * 內部用「台」；送 NLSC 時改回「臺」。
 */

const CITY_ALIASES = [
  ["台北市", "臺北市"],
  ["台中市", "臺中市"],
  ["台南市", "臺南市"],
  ["台東縣", "臺東縣"],
];

const CITY_RE =
  /(臺北市|台北市|新北市|桃園市|臺中市|台中市|臺南市|台南市|高雄市|基隆市|新竹市|新竹縣|苗栗縣|彰化縣|南投縣|雲林縣|嘉義市|嘉義縣|屏東縣|宜蘭縣|花蓮縣|臺東縣|台東縣|澎湖縣|金門縣|連江縣)/;

const FLOOR_TAIL =
  /(?:地下|B)?\d+\s*(?:樓|F|f|層)(?:之\d+)?.*$|[Bb]\d+.*$|[一二三四五六七八九十]+樓.*$/u;
const ROOM_TAIL = /\d+\s*(?:室|房).*$/u;
const OFFICE_TOWER =
  /商務中心|虛擬辦公|登記專用|純登記|世貿大樓|金融大樓|科技大樓|企業總部|營運總部|商務大樓/;

export function halfWidth(value) {
  return String(value ?? "")
    .replace(/[０-９]/g, (digit) => String.fromCharCode(digit.charCodeAt(0) - 0xfee0))
    .replace(/[Ａ-Ｚ]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0xfee0))
    .replace(/[ａ-ｚ]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0xfee0))
    .replace(/[Ｏ○〇]/g, "0")
    .replace(/[－–—]/g, "-")
    .replace(/[，]/g, ",")
    .replace(/[（]/g, "(")
    .replace(/[）]/g, ")");
}

export function compactKey(value) {
  return halfWidth(value)
    .toLowerCase()
    .replaceAll("臺", "台")
    .replace(/[（）()]/g, "")
    .replace(/[\s\-_.＋+]/g, "");
}

export function stripFloor(address) {
  return halfWidth(address)
    .replace(/\s+/g, "")
    .replace(FLOOR_TAIL, "")
    .replace(ROOM_TAIL, "")
    .replace(/[（(][^)）]*[)）]/g, "")
    .trim();
}

/** Cache key — keep compatible with existing gcis-geocode-cache.json. */
export function cacheKey(address) {
  return compactKey(stripFloor(address));
}

function canonicalCityChar(text) {
  let next = text.replaceAll("臺", "台");
  return next;
}

function normalizeHouseToken(value) {
  return value
    .replace(/(\d+)號之(\d+)/g, "$1之$2號")
    .replace(/(\d+)-(\d+)號/g, "$1之$2號")
    .replace(/號(\d+)/g, "號");
}

/**
 * Spec example:
 * 臺南市 北區 海安路三段 500 巷 39 號 1 樓
 * → 台南市北區海安路三段500巷39號
 */
export function normalizeDoorAddress(address) {
  let next = halfWidth(address);
  next = next.replace(/\s+/g, "");
  next = next.replace(/[（(][^)）]*[)）]/g, "");
  next = canonicalCityChar(next);
  next = next.replace(/[\u4e00-\u9fff]{1,4}里(?:\d+鄰)?/u, "");
  next = next.replace(/\d+鄰/u, "");
  next = next.replace(FLOOR_TAIL, "");
  next = next.replace(ROOM_TAIL, "");
  next = normalizeHouseToken(next);
  next = next.replace(/大道/g, "大道");
  return next.trim();
}

/** NLSC 圖資習慣用「臺」。 */
export function nlscQuery(address) {
  const door = normalizeDoorAddress(address);
  return door.replaceAll("台", "臺");
}

export function cityFromAddress(address) {
  const match = halfWidth(address).match(CITY_RE);
  const raw = match?.[1];
  if (!raw) return null;
  return raw.replaceAll("台", "臺");
}

export function districtFromAddress(address, city) {
  const text = halfWidth(address).replaceAll("台", "臺");
  const canonCity = city ? city.replaceAll("台", "臺") : "";
  const rest =
    canonCity && text.includes(canonCity)
      ? text.slice(text.indexOf(canonCity) + canonCity.length)
      : text;
  return rest.match(/^(.{1,4}[鄉鎮市區])/u)?.[1] ?? null;
}

export function hasHouseNumber(address) {
  return /\d+號/.test(halfWidth(address).replace(/\s+/g, ""));
}

export function hasLaneOrAlley(address) {
  return /[巷弄]/.test(halfWidth(address));
}

export function hasRoad(address) {
  return /(?:路|街|大道)/.test(halfWidth(address));
}

export function floorLevel(address) {
  const text = halfWidth(address).replace(/\s+/g, "");
  if (/地下|[Bb]\d/.test(text)) return 0;
  const western = text.match(/(\d+)(?:樓|F|f|層)/);
  if (western) return Number(western[1]);
  const zh = text.match(/([一二三四五六七八九十]+)樓/);
  if (!zh) return null;
  const map = { 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9, 十: 10 };
  const token = zh[1];
  if (token === "十") return 10;
  if (token.startsWith("十")) return 10 + (map[token.slice(1)] || 0);
  if (token.endsWith("十")) return (map[token[0]] || 1) * 10;
  return map[token] ?? null;
}

export function looksLikeStorefront(kind, address) {
  const text = halfWidth(address);
  if (kind === "business") return true;
  const floor = floorLevel(text);
  if (floor == null) return !/樓/.test(text);
  if (floor <= 2) return true;
  return false;
}

export function looksLikeOfficeTower(address) {
  return OFFICE_TOWER.test(halfWidth(address));
}

export function addressParts(address) {
  const door = normalizeDoorAddress(address);
  const city = cityFromAddress(door) || "";
  const town = districtFromAddress(door, city) || "";
  const rest = door
    .replaceAll("臺", "台")
    .replace(city.replaceAll("臺", "台"), "")
    .replace(town.replaceAll("臺", "台"), "");
  const road = rest.match(/(.+?(?:路|街|大道|道))/u)?.[1] ?? "";
  const afterRoad = road ? rest.slice(rest.indexOf(road) + road.length) : rest;
  const section = afterRoad.match(/^([0-9一二三四五六七八九十]+段)/u)?.[1] ?? "";
  const afterSection = section ? afterRoad.slice(section.length) : afterRoad;
  const lane = afterSection.match(/^(\d+巷)/u)?.[1] ?? "";
  const afterLane = lane ? afterSection.slice(lane.length) : afterSection;
  const alley = afterLane.match(/^(\d+弄)/u)?.[1] ?? "";
  const afterAlley = alley ? afterLane.slice(alley.length) : afterLane;
  const house = afterAlley.match(/^(\d+)(?:之(\d+))?號/u);
  return {
    city: city.replaceAll("台", "臺"),
    town,
    road,
    section,
    lane,
    alley,
    number: house?.[1] ?? "",
    subNumber: house?.[2] ?? "",
    hasHouse: Boolean(house),
    hasLane: Boolean(lane || alley),
    hasRoad: Boolean(road),
  };
}

/**
 * A 完整門牌精確命中
 * B 門牌命中，但樓層／室號移除後成功
 * C 只命中路段／巷弄
 * D 只命中道路中心點
 * E 完全無法可靠配對
 */
export function classifyMatchQuality(address, hit) {
  if (!hit || !Number.isFinite(hit.lat) || !Number.isFinite(hit.lng)) return "E";
  const parts = addressParts(address);
  const original = halfWidth(address).replace(/\s+/g, "");
  const strippedFloor = Boolean(original.match(FLOOR_TAIL) || original.match(ROOM_TAIL));
  const label = compactKey(hit.label || hit.content || "");
  const house = parts.number ? `${parts.number}${parts.subNumber ? `之${parts.subNumber}` : ""}號` : "";
  const kind = String(hit.kind || "");

  if (kind === "ADDRESS" || kind === "poi") {
    if (house && label.includes(compactKey(house))) {
      return strippedFloor ? "B" : "A";
    }
    if (parts.hasHouse) return strippedFloor ? "B" : "A";
    if (parts.hasLane) return "C";
    return "D";
  }
  if (kind === "CROSSROAD") {
    if (parts.hasLane && (label.includes("巷") || label.includes("弄") || parts.hasLane)) {
      return "C";
    }
    return "D";
  }
  if (kind === "cache") {
    if (parts.hasHouse) return strippedFloor ? "B" : "A";
    if (parts.hasLane) return "C";
    return "D";
  }
  if (parts.hasHouse && (kind === "ADDRESS" || !kind)) return strippedFloor ? "B" : "A";
  if (parts.hasLane) return "C";
  if (parts.hasRoad) return "D";
  return "E";
}

export function qualityAllowsNavIndex(quality) {
  return quality === "A" || quality === "B" || quality === "C";
}

export function qualityAllowsStorefrontNav(quality) {
  return quality === "A" || quality === "B";
}

export const COUNTIES = [
  "臺北市",
  "新北市",
  "桃園市",
  "臺中市",
  "臺南市",
  "高雄市",
  "基隆市",
  "新竹市",
  "新竹縣",
  "苗栗縣",
  "彰化縣",
  "南投縣",
  "雲林縣",
  "嘉義市",
  "嘉義縣",
  "屏東縣",
  "宜蘭縣",
  "花蓮縣",
  "臺東縣",
  "澎湖縣",
  "金門縣",
  "連江縣",
];

export { CITY_ALIASES };
