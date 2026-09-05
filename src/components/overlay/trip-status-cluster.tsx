"use client";

import { formatEtaClock } from "@/lib/travel-mode";

export function TripStatusCluster({
  remainingMeters,
  remainingSeconds,
}: {
  remainingMeters: number | null;
  remainingSeconds: number | null;
}) {
  const minutes =
    remainingSeconds != null
      ? Math.max(1, Math.round(remainingSeconds / 60))
      : null;
  const km =
    remainingMeters != null
      ? remainingMeters >= 10000
        ? (remainingMeters / 1000).toFixed(0)
        : (remainingMeters / 1000).toFixed(1)
      : "--";
  const eta =
    remainingSeconds != null ? formatEtaClock(remainingSeconds) : "--";

  return (
    <div className="hud-trip-card pointer-events-none grid grid-cols-3 divide-x divide-white/20 text-white shadow-lg">
      <div className="hud-trip-cell">
        <p className="hud-trip-label">剩餘時間</p>
        <p className="hud-trip-metric hud-trip-metric--time">
          {minutes != null ? `${minutes}` : "--"}
          <span className="hud-trip-metric-unit">分鐘</span>
        </p>
      </div>
      <div className="hud-trip-cell">
        <p className="hud-trip-label">剩餘距離</p>
        <p className="hud-trip-metric hud-trip-metric--distance">
          {km}
          <span className="hud-trip-metric-unit">km</span>
        </p>
      </div>
      <div className="hud-trip-cell">
        <p className="hud-trip-label">預計抵達</p>
        <p className="hud-trip-metric hud-trip-metric--eta">{eta}</p>
      </div>
    </div>
  );
}
