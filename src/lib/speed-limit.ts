export type SpeedLimitReading = {
  speedLimitKph: number | null;
  source: "route" | "osm" | "NOT CONFIGURED";
  updatedAt: string | null;
  confidence: number;
  status: "live" | "stale" | "unknown" | "not_configured";
};

export function isReliableSpeedLimit(limit: SpeedLimitReading) {
  return (
    limit.speedLimitKph != null &&
    Number.isFinite(limit.speedLimitKph) &&
    limit.speedLimitKph > 0 &&
    limit.source !== "NOT CONFIGURED" &&
    (limit.status === "live" || limit.status === "stale")
  );
}

export function unresolvedSpeedLimit(): SpeedLimitReading {
  return {
    speedLimitKph: null,
    source: "NOT CONFIGURED",
    updatedAt: null,
    confidence: 0,
    status: "not_configured",
  };
}

export function speedLimitFromRouteAttribute(
  maxspeed: number | string | null | undefined,
  updatedAt?: string | null,
): SpeedLimitReading {
  const value =
    typeof maxspeed === "number"
      ? maxspeed
      : typeof maxspeed === "string"
        ? Number(maxspeed.replace(/[^\d.]/g, ""))
        : NaN;
  if (!Number.isFinite(value) || value <= 0 || value > 140) {
    return unresolvedSpeedLimit();
  }
  return {
    speedLimitKph: Math.round(value),
    source: "route",
    updatedAt: updatedAt ?? null,
    confidence: 0.7,
    status: "live",
  };
}
