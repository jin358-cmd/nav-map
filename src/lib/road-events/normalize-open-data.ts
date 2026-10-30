import { dateInWindow, parseTaiwanDate } from "./dates";
import {
  geometryFromPositions,
  geometryUsable,
  precisionOf,
} from "./geometry";
import { twd97Tm2ToWgs84 } from "./twd97";
import type { NormalizedRoadEvent, RoadEventGeometry, SourceNormalizeResult } from "./types";
import { parseWkt } from "./wkt";

type Pair = [number, number];

function text(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed || null;
}

function emptyResult(
  sourceDataset: string,
  error: string | null,
  updateTime: string | null = null,
): SourceNormalizeResult {
  return {
    sourceDataset,
    ok: error == null,
    error,
    updateTime,
    rawCount: 0,
    uniqueCount: 0,
    byEventType: {},
    withCoordinates: 0,
    activeCount: 0,
    events: [],
  };
}

function finish(
  sourceDataset: string,
  updateTime: string | null,
  rawCount: number,
  events: NormalizedRoadEvent[],
): SourceNormalizeResult {
  const unique = dedupeById(events);
  return {
    sourceDataset,
    ok: true,
    error: null,
    updateTime,
    rawCount,
    uniqueCount: unique.length,
    byEventType: { "2": unique.length },
    withCoordinates: unique.filter((event) => event.locationPrecision !== "none").length,
    activeCount: unique.length,
    events: unique,
  };
}

function dedupeById(events: NormalizedRoadEvent[]) {
  const seen = new Map<string, NormalizedRoadEvent>();
  for (const event of events) {
    if (!seen.has(event.id)) seen.set(event.id, event);
  }
  return [...seen.values()];
}

function eventBase(
  partial: Omit<NormalizedRoadEvent, "eventType" | "eventTypeCode" | "dedupedWith" | "locationPrecision"> & {
    geometry: RoadEventGeometry | null;
  },
): NormalizedRoadEvent {
  const geometry = partial.geometry && geometryUsable(partial.geometry) ? partial.geometry : null;
  return {
    ...partial,
    geometry,
    eventType: "construction",
    eventTypeCode: 2,
    locationPrecision: precisionOf(geometry),
    dedupedWith: [],
  };
}

function stripBom(textValue: string) {
  return textValue.charCodeAt(0) === 0xfeff ? textValue.slice(1) : textValue;
}

export function parseCsv(textValue: string): Record<string, string>[] {
  const text = stripBom(textValue).replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i += 1;
        } else {
          quoted = false;
        }
      } else {
        cell += ch;
      }
      continue;
    }
    if (ch === '"') {
      quoted = true;
      continue;
    }
    if (ch === ",") {
      row.push(cell);
      cell = "";
      continue;
    }
    if (ch === "\n") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
      continue;
    }
    cell += ch;
  }
  if (cell.length || row.length) {
    row.push(cell);
    rows.push(row);
  }
  const [header, ...body] = rows.filter((record) => record.some((value) => value.trim()));
  if (!header) return [];
  return body.map((values) => {
    const record: Record<string, string> = {};
    header.forEach((key, index) => {
      record[key.trim()] = values[index] ?? "";
    });
    return record;
  });
}

function parseJson(textValue: string): unknown {
  return JSON.parse(stripBom(textValue));
}

function projectPair(x: number, y: number): Pair | null {
  const pair = twd97Tm2ToWgs84(x, y, 121);
  return pair;
}

export function normalizeTaipeiToday(
  payload: unknown,
  options: { today: string; updateTime: string | null },
): SourceNormalizeResult {
  const features =
    payload && typeof payload === "object" && Array.isArray((payload as { features?: unknown }).features)
      ? (payload as { features: Record<string, unknown>[] }).features
      : [];
  const events: NormalizedRoadEvent[] = [];
  for (const feature of features) {
    const properties = (feature.properties ?? {}) as Record<string, unknown>;
    const start = parseTaiwanDate(properties.Cb_Da);
    const end = parseTaiwanDate(properties.Ce_Da);
    if (!dateInWindow(options.today, start, end)) continue;
    const permitId = text(properties.Ac_no);
    const positions = geometryFromPositions(
      properties.Positions,
      text(properties.Positions_type),
      121,
    );
    const point = geometryFromPositions(
      (feature.geometry as { coordinates?: unknown } | undefined)?.coordinates,
      text((feature.geometry as { type?: unknown } | undefined)?.type),
      121,
    );
    const blocked = text(properties.IsBlock) === "是";
    events.push(
      eventBase({
        id: `open:taipei-today:${permitId ?? "unknown"}:${text(properties.sno) ?? "x"}:${events.length}`,
        severity: blocked ? "影響通行" : "未阻斷",
        title: text(properties.Addr),
        description: text(properties.NPurp) ?? text(properties.WItem),
        road: text(properties.Addr),
        direction: null,
        startTime: start,
        endTime: end,
        source: "臺北市政府工務局",
        sourceDataset: "open:taipei-today",
        sourceUpdateTime: options.updateTime,
        geometry: positions ?? point,
        permitId,
        city: "taipei",
      }),
    );
  }
  return finish("open:taipei-today", options.updateTime, features.length, events);
}

export function normalizeTaipeiTomorrow(
  payload: unknown,
  options: { today: string; updateTime: string | null },
): SourceNormalizeResult {
  const features =
    payload && typeof payload === "object" && Array.isArray((payload as { features?: unknown }).features)
      ? (payload as { features: unknown[] }).features
      : [];
  const result = emptyResult("open:taipei-tomorrow", null, options.updateTime);
  result.rawCount = features.length;
  result.uniqueCount = features.length;
  result.byEventType = { "2": features.length };
  result.activeCount = 0;
  result.ok = true;
  return result;
}

function createdAt(value: string) {
  try {
    const parsed = JSON.parse(value) as { date?: string };
    return text(parsed.date);
  } catch {
    return text(value);
  }
}

export function normalizeNewTaipeiLive(
  csv: string,
  options: { today: string; updateTime: string | null },
): SourceNormalizeResult {
  const rows = parseCsv(csv);
  const stamps = rows.map((row) => createdAt(row.createdatetime ?? "")).filter(Boolean);
  const updateTime = stamps.sort().at(-1) ?? options.updateTime;
  const events: NormalizedRoadEvent[] = [];
  for (const row of rows) {
    const start = parseTaiwanDate(row.casestartdate_yyymmddroc);
    const end = parseTaiwanDate(row.caseenddate_yyymmddroc);
    const checkin = parseTaiwanDate(row.checkindatetime_yyymmddhhmmroc);
    if (!checkin || !dateInWindow(options.today, start, end) || checkin > options.today) continue;
    let geometry: RoadEventGeometry | null = null;
    if (row.constructiongeomtext && row.constructiongeomtype) {
      try {
        geometry = geometryFromPositions(
          JSON.parse(row.constructiongeomtext),
          row.constructiongeomtype,
          121,
        );
      } catch {
        geometry = null;
      }
    }
    const x = Number(row.twd97x);
    const y = Number(row.twd97y);
    const point = projectPair(x, y);
    const pointGeometry =
      point && geometryFromPositions(point, "Point", null);
    const road = [row.road, row.street, row.section, row.lane].filter(Boolean).join("") || text(row.digsite);
    events.push(
      eventBase({
        id: `open:newtaipei-live:${row.caseid || row.licno}`,
        severity: row.islongtermfence === "是" ? "長設圍籬" : null,
        title: text(row.constname) ?? text(row.digsite),
        description: text(row.purpose),
        road,
        direction: null,
        startTime: checkin,
        endTime: end,
        source: "新北市政府工務局",
        sourceDataset: "open:newtaipei-live",
        sourceUpdateTime: updateTime,
        geometry: geometry ?? pointGeometry,
        permitId: text(row.licno) ?? text(row.caseid),
        city: "new-taipei",
      }),
    );
  }
  return finish("open:newtaipei-live", updateTime, rows.length, events);
}

export function normalizeNewTaipeiDaily(
  csv: string,
  options: { updateTime: string | null },
): SourceNormalizeResult {
  const rows = parseCsv(csv);
  const result = emptyResult("open:newtaipei-daily", null, options.updateTime);
  result.ok = true;
  result.rawCount = rows.length;
  result.uniqueCount = new Set(rows.map((row) => row.caseid)).size;
  result.byEventType = { "2": rows.length };
  result.activeCount = 0;
  return result;
}

export function normalizeTaichung(
  payload: unknown,
  options: { today: string; updateTime: string | null },
): SourceNormalizeResult {
  const rows = Array.isArray(payload) ? payload : [];
  const events: NormalizedRoadEvent[] = [];
  for (const value of rows) {
    if (!value || typeof value !== "object") continue;
    const row = value as Record<string, unknown>;
    if (text(row["是否開工"]) !== "是") continue;
    const start = parseTaiwanDate(row["核准起日期"]);
    const end = parseTaiwanDate(row["核准迄日期"]);
    if (!dateInWindow(options.today, start, end)) continue;
    const polygon = text(row["施工範圍坐標"]);
    const parsed = polygon ? parseWkt(polygon) : null;
    const lng = Number(row["經度"]);
    const lat = Number(row["緯度"]);
    const point =
      Number.isFinite(lng) && Number.isFinite(lat)
        ? geometryFromPositions([lng, lat], "Point", null)
        : null;
    const permitId = text(row["許可證編號"]) ?? text(row["申請書編號"]);
    events.push(
      eventBase({
        id: `open:taichung:${permitId ?? "row"}:${events.length}`,
        severity: null,
        title: text(row["工程名稱"]) ?? text(row["地點"]),
        description: text(row["案件類別"]),
        road: text(row["地點"]),
        direction: null,
        startTime: start,
        endTime: end,
        source: "臺中市政府建設局",
        sourceDataset: "open:taichung",
        sourceUpdateTime: options.updateTime,
        geometry: parsed && geometryUsable(parsed) ? parsed : point,
        permitId,
        city: "taichung",
      }),
    );
  }
  return finish("open:taichung", options.updateTime, rows.length, events);
}

function tagText(block: string, tag: string) {
  const match = new RegExp(`<${tag}[^>]*>([^<]*)</${tag}>`).exec(block);
  return text(match?.[1] ?? "");
}

function gmlPairs(textValue: string): Pair[] {
  return textValue
    .trim()
    .split(/\s+/)
    .map((pair) => pair.split(",").map(Number))
    .filter((pair) => pair.length >= 2 && Number.isFinite(pair[0]) && Number.isFinite(pair[1]))
    .map((pair) => [pair[0], pair[1]] as Pair);
}

export function normalizeChiayiXml(
  xml: string,
  options: { today: string; updateTime: string | null },
): SourceNormalizeResult {
  const cases = xml.split(/<CASE_DETAIL\b/).slice(1);
  const events: NormalizedRoadEvent[] = [];
  const lastMods: string[] = [];
  for (const part of cases) {
    const block = part.split(/<\/CASE_DETAIL>/)[0] ?? "";
    const lastMod = /LASTMOD="([^"]+)"/.exec(part)?.[1] ?? "";
    if (lastMod) lastMods.push(lastMod);
    const start = parseTaiwanDate(tagText(block, "ABE_DA"));
    const end = parseTaiwanDate(tagText(block, "AEN_DA"));
    const closed = tagText(block, "CL_DA");
    if (closed || !dateInWindow(options.today, start, end)) continue;
    const polyList = block.split(/<POLY_LIST\b/)[1]?.split(/<\/POLY_LIST>/)[0] ?? "";
    const rings: Pair[][] = [];
    for (const detail of polyList.split(/<POLY_DETAIL\b/).slice(1)) {
      const polyOnly = detail.split(/<WAREA_POINT\b/)[0] ?? "";
      for (const match of polyOnly.matchAll(/<[\w:]*coordinates>([^<]+)<\/[\w:]*coordinates>/g)) {
        const ring = gmlPairs(match[1])
          .map((pair) => projectPair(pair[0], pair[1]))
          .filter((pair): pair is Pair => Boolean(pair));
        if (ring.length >= 3) rings.push(ring);
      }
    }
    let geometry: RoadEventGeometry | null = null;
    if (rings.length === 1) geometry = { type: "Polygon", coordinates: [rings[0]] };
    else if (rings.length > 1) {
      geometry = { type: "MultiPolygon", coordinates: rings.map((ring) => [ring]) };
    } else {
      const center = /<[\w:]*coordinates>([^<]+)<\/[\w:]*coordinates>/.exec(block);
      const pair = center ? gmlPairs(center[1])[0] : null;
      const projected = pair ? projectPair(pair[0], pair[1]) : null;
      if (projected) geometry = { type: "Point", coordinates: projected };
    }
    const permitId = tagText(block, "AC_NO");
    events.push(
      eventBase({
        id: `open:chiayi:${permitId ?? tagText(block, "CASE_ID") ?? "row"}:${events.length}`,
        severity: null,
        title: tagText(block, "CONST_NAME") ?? tagText(block, "LOCATION"),
        description: tagText(block, "LOCATION"),
        road: tagText(block, "LOCATION"),
        direction: null,
        startTime: start,
        endTime: end,
        source: "嘉義市政府",
        sourceDataset: "open:chiayi",
        sourceUpdateTime: options.updateTime ?? lastMods.sort().at(-1) ?? null,
        geometry,
        permitId,
        city: "chiayi-city",
      }),
    );
  }
  const updateTime = options.updateTime ?? lastMods.sort().at(-1) ?? null;
  return finish("open:chiayi", updateTime, cases.length, events);
}

export function parseOpenPayload(format: string, body: string) {
  if (format === "csv") return body;
  if (format === "xml") return body;
  return parseJson(body);
}
