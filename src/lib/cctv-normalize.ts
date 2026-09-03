import type {
  CctvCamera,
  CctvDataOrigin,
  CctvSourceType,
  CctvStatus,
  LngLat,
} from "@/types/domain";

export type CctvFallbackRecord = {
  id: string;
  sourceType: CctvSourceType;
  city: string;
  cityCode?: string;
  roadName: string;
  crossRoad: string;
  description: string;
  stake: string;
  lng: number;
  lat: number;
  url: string;
  direction: string;
};

const MAINTENANCE_PATTERN =
  /維修|維護中|影像維護|施工中|暫停|故障|無訊號|黑畫面|無畫面|測試中|停用|關閉|無法顯示|offline|out[\s_-]?of[\s_-]?service|maintenance/i;

export function isCameraUrlUsable(url: string): boolean {
  if (!url) return false;
  try {
    const parsed = new URL(url);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

export function directionLabel(code: string): string {
  if (code === "N") return "北向";
  if (code === "S") return "南向";
  if (code === "E") return "東向";
  if (code === "W") return "西向";
  return "";
}

function normalizeRoadToken(value: string): string {
  return String(value || "")
    .replace(/[()（）\[\]【】]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function intersectionRoads(record: {
  description?: string;
  stake?: string;
  roadName?: string;
  crossRoad?: string;
}): [string, string] {
  const parts: string[] = [];
  const push = (value?: string) => {
    const token = normalizeRoadToken(value || "");
    if (token && !parts.includes(token)) parts.push(token);
  };

  for (const raw of [record.description, record.stake, record.roadName]) {
    if (!raw) continue;
    if (/與/.test(raw)) {
      raw.split(/與/).forEach((piece) => push(piece));
      break;
    }
    if (/到/.test(raw) && /國道|快速|公路/.test(raw)) {
      raw
        .replace(/^.*?(國道[^()（）]*)/, "$1")
        .split(/到/)
        .forEach((piece) => push(piece.replace(/[()（）]/g, " ")));
      break;
    }
    if (/[／/]/.test(raw)) {
      raw.split(/[／/]/).forEach((piece) => push(piece));
      break;
    }
  }

  push(record.roadName);
  push(record.description);
  push(record.stake);
  push(record.crossRoad);

  if (!parts.length) return ["未提供路名", ""];
  if (parts.length === 1) return [parts[0], ""];
  return [parts[0], parts[1]];
}

export function formatIntersection(roadA: string, roadB?: string) {
  const a = normalizeRoadToken(roadA);
  const b = normalizeRoadToken(roadB || "");
  if (!a && !b) return "未提供路名";
  if (!b) return a;
  return `${a} × ${b}`;
}

export function inferAvailability(record: CctvFallbackRecord): CctvStatus {
  const blob = `${record.description} ${record.stake} ${record.roadName} ${record.url}`;
  if (MAINTENANCE_PATTERN.test(blob)) return "unsupported";
  if (!isCameraUrlUsable(record.url)) return "offline";
  return "unknown";
}

export function normalizeFallbackCamera(
  record: CctvFallbackRecord,
  dataOrigin: CctvDataOrigin,
): CctvCamera | null {
  if (!Number.isFinite(record.lat) || !Number.isFinite(record.lng)) {
    return null;
  }
  const [roadA, roadB] = intersectionRoads(record);
  const dirLabel = directionLabel(record.direction);
  const location: LngLat = { lng: record.lng, lat: record.lat };
  const intersection = formatIntersection(roadA, roadB);
  const name =
    record.sourceType === "freeway" ? record.stake || record.id : intersection;

  return {
    id: record.id,
    name,
    intersection,
    roadName: record.roadName || roadA,
    crossRoad: record.crossRoad || roadB,
    direction: record.direction,
    directionLabel: dirLabel,
    district: record.city,
    city: record.city,
    sourceType: record.sourceType,
    dataOrigin,
    status: inferAvailability(record),
    location,
    url: record.url,
    updatedAt: new Date().toISOString(),
    snapshotLabel:
      record.sourceType === "freeway" ? "國道 CCTV" : "市區路口監控",
  };
}

export function dataOriginLabel(origin: CctvDataOrigin): string {
  if (origin === "tdx-live") return "TDX LIVE";
  if (origin === "snapshot") return "SNAPSHOT";
  if (origin === "mock") return "示範資料";
  return "資料暫時無法取得";
}
