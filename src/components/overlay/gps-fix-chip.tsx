"use client";

import type { GpsErrorCode, GpsPermissionState, GpsStatus, VehiclePose } from "@/types/domain";
import { geoErrorMessage } from "@/services/geolocation";
import { cn } from "@/lib/utils";

function permissionLabel(state: GpsPermissionState) {
  if (state === "granted") return "granted";
  if (state === "denied") return "denied";
  if (state === "unsupported") return "unsupported";
  return "prompt";
}

function formatCoord(value: number) {
  return value.toFixed(6);
}

export function GpsFixChip({
  vehicle,
  status,
  permission,
  error,
  tone = "dark",
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
      ? `GPS ± ${Math.round(vehicle.accuracy)} m`
      : status === "locating"
        ? "GPS 定位中…"
        : status === "denied"
          ? "定位權限被拒"
          : status === "unavailable" && error
            ? geoErrorMessage(error)
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
        "max-w-[min(9.5rem,28vw)] text-right text-[10px] leading-snug",
        retryable ? "pointer-events-auto cursor-pointer" : "pointer-events-none",
        tone === "light"
          ? "text-[#1F2937] [text-shadow:0_0_2px_#fff,0_1px_2px_rgba(255,255,255,0.92)]"
          : "text-white [text-shadow:0_0_2px_#000,0_1px_2px_rgba(0,0,0,0.88)]",
      )}
      title="定位狀態"
    >
      <p className="font-medium">{accuracy}</p>
      {live ? (
        <>
          <p className="tabular-nums">{formatCoord(vehicle.lat)}</p>
          <p className="tabular-nums">{formatCoord(vehicle.lng)}</p>
        </>
      ) : (
        <p>等待座標</p>
      )}
      {error || permission === "denied" ? (
        <p>
          {permissionLabel(permission)}
          {error ? ` · ${error}` : ""}
        </p>
      ) : null}
    </div>
  );
}
