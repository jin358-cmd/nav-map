"use client";

import { cn } from "@/lib/utils";
import type { SpeedCameraAlert } from "@/lib/speed-camera-alert";

export function SpeedCameraCaution({
  alert,
}: {
  alert: SpeedCameraAlert;
}) {
  const meters = Math.max(0, Math.round(alert.distanceMeters));
  const copy =
    alert.phase === 50
      ? "即將測速，請減速"
      : alert.phase === 150
        ? "接近測速，請減速"
        : "前方測速，請減速";

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
      <p className="speed-camera-caution__title">測速照相</p>
      <p className="speed-camera-caution__copy">{copy}</p>
      <p className="speed-camera-caution__meta">
        前方 {meters} 公尺 · 限速 {alert.speedLimitKph}
      </p>
    </div>
  );
}
