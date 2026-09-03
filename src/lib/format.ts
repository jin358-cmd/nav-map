import type {
  CctvDataOrigin,
  CctvStatus,
  DataFreshness,
  DisasterDataOrigin,
  EventDataOrigin,
  ParkingDataOrigin,
  TrafficDataOrigin,
  TrafficLevel,
} from "@/types/domain";

export function formatDistance(meters: number): string {
  if (meters >= 1000) {
    const km = meters / 1000;
    return `${km >= 10 ? km.toFixed(0) : km.toFixed(1)} 公里`;
  }
  return `${Math.round(meters)} 公尺`;
}

export function formatDistanceKm(km?: number): string {
  if (!Number.isFinite(km)) return "--";
  const meters = (km ?? 0) * 1000;
  return formatDistance(meters);
}

export function cctvStatusLabel(status: CctvStatus) {
  if (status === "online") return "在線";
  if (status === "offline") return "離線";
  if (status === "unsupported") return "無法使用";
  return "未知";
}

export function providedText(value?: string | null) {
  const text = value?.trim();
  return text ? text : "未提供";
}

export function freshnessLabel(value?: DataFreshness) {
  if (value === "live") return "即時";
  if (value === "stale") return "資料偏舊";
  return "資料暫時無法取得";
}

export function eventOriginLabel(origin?: EventDataOrigin | TrafficDataOrigin | DisasterDataOrigin | CctvDataOrigin | ParkingDataOrigin) {
  if (origin === "tdx-live") return "TDX 即時資料";
  if (origin === "tainan-open") return "臺南市停車動態資訊";
  if (origin === "ncdr-live") return "NCDR 即時災害";
  if (origin === "snapshot") return "SNAPSHOT";
  if (origin === "mock") return "示範資料";
  return "資料暫時無法取得";
}

export function cctvOriginLabel(origin: CctvDataOrigin) {
  if (origin === "tdx-live") return "TDX LIVE";
  if (origin === "snapshot") return "SNAPSHOT";
  if (origin === "mock") return "示範資料";
  return "資料暫時無法取得";
}

export function trafficOriginLabel(origin: TrafficDataOrigin) {
  if (origin === "tdx-live") return "TDX 即時路況";
  if (origin === "mock") return "示範路況";
  return "資料暫時無法取得";
}

export function disasterOriginLabel(origin: DisasterDataOrigin) {
  if (origin === "ncdr-live") return "NCDR 即時災害";
  if (origin === "mock") return "示範災害";
  return "資料暫時無法取得";
}

export function trafficLevelLabel(level: TrafficLevel) {
  if (level === "smooth") return "順暢";
  if (level === "slow") return "車多";
  if (level === "congested") return "壅塞";
  if (level === "severe") return "嚴重壅塞";
  return "接近停止";
}

export function formatUpdatedAt(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "時間未知";
  return date.toLocaleString("zh-TW", { hour12: false });
}
