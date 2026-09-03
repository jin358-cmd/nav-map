import "server-only";

import { TAINAN_DISASTERS } from "@/data/mock-disasters";
import { isDemoDataEnabled } from "@/lib/runtime-demo";
import type {
  DisasterAlert,
  DisasterCatalog,
  DisasterKind,
} from "@/types/domain";

const DEFAULT_FEED = "https://alerts.ncdr.nat.gov.tw/JSONAtomFeed.ashx";
const FETCH_TIMEOUT_MS = 10_000;
const LIVE_CACHE_MS = 120_000;
const MAX_CAP_FETCHES = 24;

let catalogCache: DisasterCatalog | null = null;
let catalogCacheAt = 0;

type NcdrEntry = {
  id?: string;
  title?: string;
  updated?: string;
  author?: { name?: string };
  link?: { "@href"?: string };
  summary?: { "#text"?: string } | string;
  effective?: string;
  expires?: string;
  status?: string;
};

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function decodeXml(value: string) {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function xmlTag(xml: string, tag: string) {
  const match = xml.match(new RegExp(`<(?:\\w+:)?${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/(?:\\w+:)?${tag}>`, "i"));
  return match ? decodeXml(match[1]).replace(/<[^>]+>/g, "").trim() : "";
}

function disasterKind(value: string): DisasterKind {
  if (/淹水|積水|洪水|水位|水庫放流/.test(value)) return "flood";
  if (/道路封閉|封路|交通中斷/.test(value)) return "closure";
  if (/地震/.test(value)) return "quake";
  if (/颱風|熱帶性低氣壓/.test(value)) return "typhoon";
  if (/豪雨|大雨|雷雨/.test(value)) return "heavy-rain";
  if (/強風|陸上強風/.test(value)) return "strong-wind";
  if (/土石流|崩塌|坡地/.test(value)) return "landslide";
  return "other";
}

function severity(value: string): DisasterAlert["severity"] {
  if (/Extreme|非常嚴重|緊急|紅色/i.test(value)) return "emergency";
  if (/Severe|嚴重|警報|橙色/i.test(value)) return "warning";
  return "watch";
}

function centroid(value: string) {
  const pairs = value
    .split(/\s+/)
    .map((pair) => pair.split(",").map(Number))
    .filter((pair) => pair.length === 2 && pair.every(Number.isFinite));
  if (!pairs.length) return null;
  const sum = pairs.reduce((acc, pair) => ({ lat: acc.lat + pair[0], lng: acc.lng + pair[1] }), { lat: 0, lng: 0 });
  return { lat: sum.lat / pairs.length, lng: sum.lng / pairs.length };
}

async function fetchText(url: string) {
  const response = await fetch(url, {
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    headers: { Accept: "application/xml,text/xml,*/*" },
    next: { revalidate: 120 },
  });
  if (!response.ok) throw new Error(`NCDR request failed (${response.status})`);
  return response.text();
}

function entrySummary(entry: NcdrEntry) {
  return text(typeof entry.summary === "string" ? entry.summary : entry.summary?.["#text"]);
}

function isTainanEntry(entry: NcdrEntry) {
  return /臺南|台南/.test(
    `${text(entry.title)} ${entrySummary(entry)} ${text(entry.author?.name)}`,
  );
}

async function normalizeEntry(entry: NcdrEntry): Promise<DisasterAlert | null> {
  const summary = entrySummary(entry);
  const capUrl = text(entry.link?.["@href"]);
  let cap = "";
  if (capUrl.startsWith("https://alerts.ncdr.nat.gov.tw/")) {
    try { cap = await fetchText(capUrl); } catch { /* feed summary remains usable */ }
  }
  const area = xmlTag(cap, "areaDesc") || summary.match(/影響範圍[:：]([^。]+)/)?.[1]?.trim() || "";
  if (!/臺南市|台南市/.test(`${summary} ${area}`)) return null;
  const point = centroid(xmlTag(cap, "polygon")) ?? centroid(xmlTag(cap, "circle"));
  if (!point) return null;
  const title = text(entry.title) || xmlTag(cap, "event") || "災害示警";
  const description = xmlTag(cap, "description") || summary || title;
  const combined = `${title} ${description} ${xmlTag(cap, "severity")}`;
  return {
    id: text(entry.id) || `ncdr-${point.lat}-${point.lng}`,
    kind: disasterKind(combined),
    title,
    description,
    location: point,
    severity: severity(combined),
    area,
    source: text(entry.author?.name) || xmlTag(cap, "senderName") || "NCDR 民生示警",
    sourceUrl: capUrl || undefined,
    effectiveAt: xmlTag(cap, "effective") || text(entry.effective) || undefined,
    expiresAt: xmlTag(cap, "expires") || text(entry.expires) || undefined,
    updatedAt: text(entry.updated) || undefined,
    dataOrigin: "ncdr-live",
  };
}

export async function fetchDisasterCatalog(): Promise<DisasterCatalog> {
  if (catalogCache && Date.now() - catalogCacheAt < LIVE_CACHE_MS) {
    return catalogCache;
  }

  const fetchedAt = new Date().toISOString();
  try {
    const response = await fetch(process.env.NCDR_ALERT_FEED_URL || DEFAULT_FEED, {
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      headers: { Accept: "application/json" },
      next: { revalidate: 120 },
    });
    if (!response.ok) throw new Error(`NCDR feed failed (${response.status})`);
    const feed = (await response.json()) as { entry?: NcdrEntry | NcdrEntry[] };
    const entries = (Array.isArray(feed.entry) ? feed.entry : feed.entry ? [feed.entry] : [])
      .filter((item) => item.status !== "Cancel" && item.status !== "System" && isTainanEntry(item))
      .slice(0, MAX_CAP_FETCHES);
    const alerts = (await Promise.all(entries.map(normalizeEntry)))
      .filter((item): item is DisasterAlert => Boolean(item));
    catalogCache = { origin: "ncdr-live", alerts, fetchedAt };
    catalogCacheAt = Date.now();
    return catalogCache;
  } catch {
    if (isDemoDataEnabled()) {
      catalogCache = {
        origin: "mock",
        alerts: TAINAN_DISASTERS.map((alert) => ({ ...alert, dataOrigin: "mock" })),
        fetchedAt,
      };
      catalogCacheAt = Date.now();
      return catalogCache;
    }
    catalogCache = {
      origin: "unavailable",
      alerts: [],
      fetchedAt,
    };
    catalogCacheAt = Date.now();
    return catalogCache;
  }
}
