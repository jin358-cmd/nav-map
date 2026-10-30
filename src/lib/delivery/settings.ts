import type { DispatchMode } from "@/lib/delivery/types";

export type DispatchSettings = {
  mode: DispatchMode;
  offerTimeoutMs: number;
  grabRadiusMeters: number;
  zoneRadiusMeters: number;
  locationStaleMs: number;
};

function clamped(value: number, fallback: number, min: number, max: number) {
  if (!Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, value));
}

export function readDispatchSettings(
  env: Record<string, string | undefined> = process.env,
): DispatchSettings {
  const mode: DispatchMode = env.DELIVERY_DISPATCH_MODE === "grab" ? "grab" : "nearest";
  return {
    mode,
    offerTimeoutMs: clamped(Number(env.DELIVERY_OFFER_TIMEOUT_SECONDS) * 1000, 45_000, 5_000, 300_000),
    grabRadiusMeters: clamped(Number(env.DELIVERY_GRAB_RADIUS_METERS), 3_000, 200, 50_000),
    zoneRadiusMeters: clamped(Number(env.DELIVERY_ZONE_RADIUS_METERS), 5_000, 200, 50_000),
    locationStaleMs: clamped(Number(env.DELIVERY_COURIER_STALE_SECONDS) * 1000, 90_000, 10_000, 600_000),
  };
}

export function isDeliveryPortalEnabled(
  env: Record<string, string | undefined> = process.env,
) {
  const flag = env.DELIVERY_PORTAL_ENABLED?.trim().toLowerCase();
  if (flag === "0" || flag === "false" || flag === "off") return false;
  if (flag === "1" || flag === "true" || flag === "on") return true;
  if (env.VERCEL_ENV === "preview" || env.VERCEL_ENV === "development") return true;
  return env.NODE_ENV !== "production";
}
