"use client";

import { cn } from "@/lib/utils";
import type { SpeedCameraAlert } from "@/lib/speed-camera-alert";

function distanceLabel(meters: number) {
  if (meters >= 250) return "300 公尺";
  if (meters >= 100) return "150 公尺";
  return "50 公尺";
}

export function SpeedCameraCaution({
  alert,
}: {
  alert: SpeedCameraAlert;
}) {
  const meters = Math.max(0, Math.round(alert.distanceMeters));
  const limit = alert.speedLimitKph > 0 ? String(alert.speedLimitKph) : "—";

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "speed-camera-caution pointer-events-none",
        alert.phase === 50
          ? "speed-camera-caution--urgent"
          : alert.phase === 150
            ? "speed-camera-caution--warn"
            : "speed-camera-caution--watch",
      )}
    >
      <span className="speed-limit-sign" aria-hidden>
        <span className="speed-limit-sign__number">{limit}</span>
      </span>
      <span className="speed-camera-caution__aside">
        <span className="speed-camera-caution__glyph" aria-hidden>
          ⌖
        </span>
        <span className="speed-camera-caution__distance">{distanceLabel(meters)}</span>
      </span>
    </div>
  );
}
