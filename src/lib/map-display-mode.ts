import type { MapDisplayMode } from "@/types/domain";

const STORAGE_KEY = "navpilot.map-display-mode.v1";

export function readMapDisplayMode(): MapDisplayMode {
  if (typeof window === "undefined") return "dark";
  try {
    const value = window.localStorage.getItem(STORAGE_KEY);
    if (value === "light" || value === "dark" || value === "auto" || value === "satellite") {
      return value;
    }
  } catch {
    /* 使用預設暗色 */
  }
  return "dark";
}

export function writeMapDisplayMode(mode: MapDisplayMode) {
  try {
    window.localStorage.setItem(STORAGE_KEY, mode);
  } catch {
    /* 略過 */
  }
}

function zonedHour(now = new Date()) {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      hour: "numeric",
      hourCycle: "h23",
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Taipei",
    }).formatToParts(now);
    return Number(parts.find((part) => part.type === "hour")?.value ?? now.getHours());
  } catch {
    try {
      const parts = new Intl.DateTimeFormat("en-US", {
        hour: "numeric",
        hourCycle: "h23",
        timeZone: "Asia/Taipei",
      }).formatToParts(now);
      return Number(parts.find((part) => part.type === "hour")?.value ?? 12);
    } catch {
      return now.getHours();
    }
  }
}

export function resolveAutoBasemap(now = new Date()): "light" | "dark" {
  const hour = zonedHour(now);
  return hour >= 6 && hour < 17 ? "light" : "dark";
}

export function resolveMapBasemap(mode: MapDisplayMode): "light" | "dark" | "satellite" {
  if (mode === "auto") return resolveAutoBasemap();
  return mode;
}

export function msUntilAutoSwitch(now = new Date()) {
  const hour = zonedHour(now);
  const nextHour = hour >= 6 && hour < 17 ? 17 : 6;
  const target = new Date(now);
  target.setMinutes(0, 0, 0);
  target.setHours(nextHour);
  if (target.getTime() <= now.getTime()) {
    target.setDate(target.getDate() + 1);
  }
  return Math.max(5_000, target.getTime() - now.getTime());
}
