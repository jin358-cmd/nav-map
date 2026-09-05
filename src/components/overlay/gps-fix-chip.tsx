"use client";

import type { GpsErrorCode, GpsPermissionState, GpsStatus, VehiclePose } from "@/types/domain";
import { cn } from "@/lib/utils";

function formatCoord(value: number) {
  return value.toFixed(6);
}

export function GpsFixChip({
  vehicle,
  status,
  error,
  onRetry,
}: {
  vehicle: VehiclePose;
  status: GpsStatus;
  permission: GpsPermissionState;
  error: GpsErrorCode;
  tone?: "light" | "dark" | "satellite";
  onRetry?: () => void;
}) {
  const live = vehicle.source === "gps";
  const accuracy =
    live && typeof vehicle.accuracy === "number"
      ? `±${Math.round(vehicle.accuracy)} m`
      : status === "locating"
        ? "定位中"
        : error
          ? "定位失敗"
          : "GPS --";
  const retryable = Boolean(onRetry) && !live;

  return (
    <div
      role={retryable ? "button" : undefined}
      tabIndex={retryable ? 0 : undefined}
      onClick={retryable ? onRetry : undefined}
      onKeyDown={
        retryable
          ? (event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                onRetry?.();
              }
            }
          : undefined
      }
      className={cn(
        "max-w-[min(8.5rem,26vw)] text-right text-[9px] leading-[1.35] text-[#3F3F46]",
        retryable ? "pointer-events-auto cursor-pointer" : "pointer-events-none",
      )}
      title="GPS 經緯度與精度"
    >
      {live ? (
        <>
          <p className="tabular-nums">{formatCoord(vehicle.lat)}</p>
          <p className="tabular-nums">{formatCoord(vehicle.lng)}</p>
          <p className="tabular-nums">{accuracy}</p>
        </>
      ) : (
        <p>{accuracy}</p>
      )}
    </div>
  );
}
