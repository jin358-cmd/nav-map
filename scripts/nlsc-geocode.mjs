/**
 * NLSC TextQueryMap helper. Improved rural query keeps 村／里／鄰 when there is no road.
 */
const NLSC_MAP = "https://api.nlsc.gov.tw/idc/TextQueryMap";
const USER_AGENT = "NavPilot/0.1 (https://github.com/jin358-cmd/nav-map; address retry)";

const FLOOR_TAIL =
  /(?:地下|B)?\d+\s*(?:樓|F|f|層)(?:之\d+)?.*$|[Bb]\d+.*$|[一二三四五六七八九十]+樓.*$/u;
const ROOM_TAIL = /\d+\s*(?:室|房).*$/u;

const CITY_BIAS = {
  臺北市: [121.56, 25.04],
  新北市: [121.46, 25.01],
  桃園市: [121.3, 24.99],
  臺中市: [120.67, 24.15],
  臺南市: [120.2, 22.99],
  高雄市: [120.31, 22.62],
  基隆市: [121.74, 25.13],
  新竹市: [120.97, 24.8],
  嘉義市: [120.45, 23.48],
  雲林縣: [120.53, 23.7],
  嘉義縣: [120.29, 23.46],
  屏東縣: [120.49, 22.67],
};

export function halfWidth(value) {
  return String(value ?? "")
    .replace(/[０-９]/g, (digit) => String.fromCharCode(digit.charCodeAt(0) - 0xfee0))
    .replace(/[Ａ-Ｚ]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0xfee0))
    .replace(/[ａ-ｚ]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0xfee0))
    .replace(/[Ｏ○〇]/g, "0")
    .replace(/[－–—]/g, "-");
}

export function officialCity(value) {
  return String(value || "")
    .replaceAll("台北", "臺北")
    .replaceAll("台中", "臺中")
    .replaceAll("台南", "臺南")
    .replaceAll("台東", "臺東");
}

/** Original ingest query — strips 里／鄰. Kept for comparison. */
export function nlscQueryLegacy(address) {
  let next = halfWidth(address).replace(/\s+/g, "");
  next = next.replace(/[（(][^)）]*[)）]/g, "");
  next = next.replace(/[\u4e00-\u9fff]{1,4}里(?:\d+鄰)?/u, "");
  next = next.replace(/\d+鄰/u, "");
  next = next.replace(FLOOR_TAIL, "");
  next = next.replace(ROOM_TAIL, "");
  next = next.replace(/(\d+)號之(\d+)/g, "$1之$2號");
  next = next.replace(/(\d+)-(\d+)號/g, "$1之$2號");
  return officialCity(next.replaceAll("台", "臺")).trim();
}

/** Retry query: keep village／鄰 when there is no road. */
export function nlscQueryImproved(address) {
  let next = halfWidth(address).replace(/\s+/g, "");
  next = next.replace(/[（(][^)）]*[)）]/g, "");
  next = next.replace(/(\d+)號之(\d+)/g, "$1之$2號");
  next = next.replace(/(\d+)-(\d+)號/g, "$1之$2號");
  next = next.replace(/(\d+)之(\d+)號/g, "$1之$2號");
  next = next.replace(FLOOR_TAIL, "");
  next = next.replace(ROOM_TAIL, "");
  const hasRoad = /(?:路|街|大道)/.test(next);
  if (hasRoad) {
    next = next.replace(/[\u4e00-\u9fff]{1,6}[村里](?:\d+鄰)?/u, "");
    next = next.replace(/\d+鄰/u, "");
  }
  return officialCity(next.replaceAll("台", "臺")).trim();
}

function parseNlsc(xml) {
  const items = [...xml.matchAll(/<ITEM>([\s\S]*?)<\/ITEM>/gi)];
  const hits = [];
  for (const item of items) {
    const block = item[1];
    const content = block.match(/<CONTENT>([\s\S]*?)<\/CONTENT>/i)?.[1]?.trim() || "";
    const key = block.match(/<KEY>([\s\S]*?)<\/KEY>/i)?.[1] || "";
    const loc = block.match(/<LOCATION>([\s\S]*?)<\/LOCATION>/i)?.[1] || "";
    const [lngRaw, latRaw] = loc.split(",");
    const lng = Number(lngRaw);
    const lat = Number(latRaw);
    if (!Number.isFinite(lng) || !Number.isFinite(lat)) continue;
    if (lng < 118 || lng > 123 || lat < 20 || lat > 27) continue;
    const kind = key.includes(",ADDRESS,")
      ? "ADDRESS"
      : key.includes(",CROSSROAD,")
        ? "CROSSROAD"
        : key.includes(",LANDGOAL,")
          ? "LANDGOAL"
          : "other";
    hits.push({ content, kind, lng, lat });
  }
  hits.sort((a, b) => Number(b.kind === "ADDRESS") - Number(a.kind === "ADDRESS"));
  return hits[0] || null;
}

async function fetchText(url, timeoutMs = 8_000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": USER_AGENT,
        Referer: "https://maps.nlsc.gov.tw/T09/",
        Accept: "application/xml",
      },
      signal: controller.signal,
    });
    const text = await response.text();
    return { ok: response.ok, status: response.status, text };
  } catch (error) {
    return { ok: false, status: 0, text: "", error: error instanceof Error ? error.message : String(error) };
  } finally {
    clearTimeout(timer);
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function geocodeNlscOnce(query, city) {
  if (!query || query.length < 4) return { hit: null, httpError: false, query };
  const [lng, lat] = CITY_BIAS[officialCity(city)] || [120.96, 23.7];
  const url = `${NLSC_MAP}/${encodeURIComponent(query)}/8/${lng}/${lat}`;
  const result = await fetchText(url);
  if (!result.ok) return { hit: null, httpError: true, status: result.status, query };
  const parsed = parseNlsc(result.text);
  if (!parsed) return { hit: null, httpError: false, query };
  return {
    hit: { lng: parsed.lng, lat: parsed.lat, kind: parsed.kind, label: parsed.content },
    httpError: false,
    query,
  };
}

export async function geocodeNlscImproved(address, city) {
  const improved = nlscQueryImproved(address);
  const legacy = nlscQueryLegacy(address);
  const queries = [...new Set([improved, legacy].filter((item) => item.length >= 4))];
  let retries = 0;
  let lastHttp = false;
  for (const query of queries) {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        const result = await geocodeNlscOnce(query, city);
        if (result.httpError) {
          lastHttp = true;
          retries += 1;
          await sleep(250 * (attempt + 1));
          continue;
        }
        return { ...result, retries, usedQuery: query, improved, legacy };
      } catch {
        lastHttp = true;
        retries += 1;
        await sleep(250 * (attempt + 1));
      }
    }
  }
  return {
    hit: null,
    httpError: lastHttp,
    retries,
    usedQuery: improved,
    improved,
    legacy,
  };
}
