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
  if (origin === "tdx-live") return "TDX 全國公有停車場";
  if (origin === "tainan-open") return "臺南市停車 Open Data";
  if (origin === "osm-open") return "OpenStreetMap 公有停車場";
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
  return "接近停滯";
}

export function formatUpdatedAt(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "時間未知";
  return date.toLocaleString("zh-TW", { hour12: false });
}

export function formatUpdatedAgo(iso?: string | null) {
  if (!iso) return "未提供";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "時間未知";
  const delta = Date.now() - date.getTime();
  if (delta < 30_000) return "剛剛";
  const minutes = Math.round(delta / 60_000);
  if (minutes < 60) return `${minutes} 分鐘前`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} 小時前`;
  return formatUpdatedAt(iso);
}

export function formatParkingRate(lot: {
  hourlyRate?: number | null;
  dailyMax?: number | null;
  fee?: string;
  feeClass?: string;
}) {
  if (lot.feeClass === "free") return "免費";
  if (lot.hourlyRate != null) {
    const daily =
      lot.dailyMax != null ? `，當日最高 ${lot.dailyMax} 元` : "";
    return `${lot.hourlyRate} 元／小時${daily}`;
  }
  const text = lot.fee?.trim();
  if (!text) return "未提供";
  if (/停車場$/.test(text) && !/\d/.test(text)) return "未提供";
  return text;
}
