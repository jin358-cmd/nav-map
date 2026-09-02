import { DISASTER_MAP_CAP } from "@/lib/disaster-constants";
import {
  firstTainanDistrict,
  locationForTainanAlert,
  mentionsTainan,
} from "@/lib/tainan-districts";
import type {
  DisasterAlert,
  DisasterDataOrigin,
  DisasterKind,
} from "@/types/domain";

export type NcdrFeedEntry = {
  id?: unknown;
  title?: unknown;
  updated?: unknown;
  author?: unknown;
  summary?: unknown;
  category?: unknown;
  status?: unknown;
  msgType?: unknown;
  effective?: unknown;
  expires?: unknown;
  link?: unknown;
};

const DRIVING_KIND_BY_CATEGORY: Record<string, DisasterKind> = {
  淹水: "flood",
  淹水感測: "flood",
  交流道下地方連絡道淹水: "flood",
  河川高水位: "flood",
  區排警戒: "flood",
  水庫放流: "flood",
  降雨: "flood",
  雷雨: "flood",
  道路封閉: "closure",
  土石流及大規模崩塌: "closure",
  疏散避難: "closure",
  地震: "quake",
  颱風: "typhoon",
  強風: "typhoon",
};

export function unwrapNcdrEntries(payload: unknown): NcdrFeedEntry[] {
  if (!payload || typeof payload !== "object") return [];
  const entry = (payload as { entry?: unknown }).entry;
  if (Array.isArray(entry)) return entry as NcdrFeedEntry[];
  if (entry && typeof entry === "object") return [entry as NcdrFeedEntry];
  return [];
}

export function readNcdrText(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (Array.isArray(value)) {
    return value.map(readNcdrText).filter(Boolean).join(" ");
  }
  if (!value || typeof value !== "object") return "";
  const record = value as Record<string, unknown>;
  return (
    readNcdrText(record["#text"]) ||
    readNcdrText(record.text) ||
    readNcdrText(record.name) ||
    readNcdrText(record["@term"]) ||
    ""
  );
}

export function parseNcdrDateTime(value: string | undefined): Date | null {
  if (!value) return null;
  const iso = Date.parse(value);
  if (!Number.isNaN(iso)) return new Date(iso);

  const match = value
    .trim()
    .match(
      /^(\d{4})\/(\d{1,2})\/(\d{1,2})\s+(上午|下午)\s+(\d{1,2}):(\d{2}):(\d{2})$/,
    );
  if (!match) return null;

  const [, year, month, day, period, hourRaw, minute, second] = match;
  let hour = Number(hourRaw);
  if (period === "下午" && hour < 12) hour += 12;
  if (period === "上午" && hour === 12) hour = 0;
  const stamp = `${year}-${pad(month)}-${pad(day)}T${pad(String(hour))}:${minute}:${second}+08:00`;
  const parsed = new Date(stamp);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function isExpiredNcdr(expires: string | undefined, now = new Date()) {
  const date = parseNcdrDateTime(expires);
  return date ? date.getTime() < now.getTime() : false;
}

export function finalizeDisasterAlert(
  alert: Omit<DisasterAlert, "dataOrigin" | "source"> & {
    dataOrigin?: DisasterDataOrigin;
    source?: DisasterAlert["source"];
  },
): DisasterAlert {
  const dataOrigin = alert.dataOrigin ?? "mock";
  return {
    ...alert,
    dataOrigin,
    source: alert.source ?? (dataOrigin === "ncdr-live" ? "NCDR 民生示警" : "mock"),
    area: alert.area ?? alert.areaDesc,
  };
}

export function normalizeNcdrEntries(
  entries: NcdrFeedEntry[],
  now = new Date(),
): DisasterAlert[] {
  const alerts: DisasterAlert[] = [];

  for (const entry of entries) {
    const alert = normalizeNcdrEntry(entry, now);
    if (alert) alerts.push(alert);
  }

  const newest = new Map<string, DisasterAlert>();
  for (const alert of alerts) {
    const key = `${alert.kind}:${alert.category ?? alert.title}:${alert.areaDesc ?? ""}`;
    const previous = newest.get(key);
    if (!previous || (alert.updatedAt ?? "") > (previous.updatedAt ?? "")) {
      newest.set(key, alert);
    }
  }

  return [...newest.values()]
    .sort((a, b) => {
      if (a.severity !== b.severity) {
        return a.severity === "warning" ? -1 : 1;
      }
      return (b.updatedAt ?? "").localeCompare(a.updatedAt ?? "");
    })
    .slice(0, DISASTER_MAP_CAP);
}

function normalizeNcdrEntry(
  entry: NcdrFeedEntry,
  now: Date,
): DisasterAlert | null {
  const status = readNcdrText(entry.status);
  const msgType = readNcdrText(entry.msgType);
  const category = readNcdrText(entry.category) || readNcdrText(entry.title);
  if (status === "System") return null;
  if (msgType === "Cancel") return null;
  if (category === "ncdrSystemTest") return null;

  const kind = DRIVING_KIND_BY_CATEGORY[category];
  if (!kind) return null;

  const expires = readNcdrText(entry.expires);
  if (isExpiredNcdr(expires, now)) return null;

  const summary = stripHtml(readNcdrText(entry.summary));
  const title = readNcdrText(entry.title) || category;
  const author = readNcdrText(entry.author);
  const haystack = `${title} ${summary} ${author} ${category}`;
  if (!isTainanRelevant(haystack, author)) return null;

  const id = readNcdrText(entry.id) || `${category}-${readNcdrText(entry.updated)}`;
  if (!id) return null;

  const placed = locationForTainanAlert(haystack, kind);
  const updated =
    parseNcdrDateTime(readNcdrText(entry.updated)) ??
    parseNcdrDateTime(readNcdrText(entry.effective));
  const effective = parseNcdrDateTime(readNcdrText(entry.effective));
  const expiresAt = parseNcdrDateTime(expires);

  return finalizeDisasterAlert({
    id,
    kind,
    title: headlineForAlert(category, placed.areaDesc),
    description: summary || `${author}發布${category}示警`.trim(),
    location: placed.location,
    severity: severityForAlert(kind, haystack),
    dataOrigin: "ncdr-live",
    source: author || "NCDR 民生示警",
    category,
    areaDesc: placed.areaDesc,
    issuedAt: (effective ?? updated)?.toISOString(),
    expiresAt: expiresAt?.toISOString(),
    updatedAt: (updated ?? now).toISOString(),
  });
}

function isTainanRelevant(text: string, author: string) {
  if (mentionsTainan(text) || mentionsTainan(author)) return true;
  return firstTainanDistrict(text) !== null && author.includes("臺南");
}

function headlineForAlert(category: string, areaDesc: string) {
  if (category === "強風") return `${areaDesc}強風注意`;
  if (category === "颱風") return `${areaDesc}颱風警戒`;
  if (category === "地震") return `${areaDesc}地震速報`;
  if (category === "道路封閉") return `${areaDesc}道路封閉`;
  if (category === "水庫放流") return `${areaDesc}水庫放流`;
  return `${areaDesc}${category}`;
}

function severityForAlert(kind: DisasterKind, text: string): "watch" | "warning" {
  if (/紅色|一級|嚴重|警告|無法通行|雙向封閉/.test(text)) return "warning";
  if (/黃色|二級|注意|黃色燈號/.test(text)) return "watch";
  if (kind === "quake" || kind === "closure") return "warning";
  if (kind === "typhoon") return "watch";
  return "watch";
}

function stripHtml(value: string) {
  return value.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function pad(value: string) {
  return value.padStart(2, "0");
}
