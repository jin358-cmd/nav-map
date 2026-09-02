import type { CctvDataOrigin, CctvStatus } from "@/types/domain";

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

export function cctvOriginLabel(origin: CctvDataOrigin) {
  if (origin === "tdx-live") return "TDX LIVE";
  if (origin === "snapshot") return "SNAPSHOT";
  return "MOCK";
}

export function formatUpdatedAt(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "時間未知";
  return date.toLocaleString("zh-TW", { hour12: false });
}
