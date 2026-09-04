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
  return value.toFixed(5);
}

function formatClock(value?: number) {
  if (!value) return "--:--:--";
  return new Date(value).toLocaleTimeString("zh-TW", { hour12: false });
}

export function GpsFixChip({
  vehicle,
  status,
  permission,
  error,
  onRetry,
}: {
  vehicle: VehiclePose;
  status: GpsStatus;
  permission: GpsPermissionState;
  error: GpsErrorCode;
  onRetry?: () => void;
}) {
  const live = vehicle.source === "gps";
  const accuracy =
    live && typeof vehicle.accuracy === "number"
      ? `${Math.round(vehicle.accuracy)}m`
      : "--";
  const headline =
    status === "locating"
      ? "定位中…"
      : status === "denied"
        ? "定位權限被拒，點此或右上定位鍵再試"
        : status === "unavailable" && error
          ? geoErrorMessage(error)
          : live
            ? `精度 ${accuracy}`
            : "點右上定位鍵開啟真實 GPS";
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
        "max-w-[min(18rem,calc(100vw-5.5rem))] rounded-xl border px-2 py-1.5 text-[10px] leading-tight shadow-lg backdrop-blur-md",
        retryable ? "pointer-events-auto cursor-pointer" : "pointer-events-none",
        live
          ? "border-emerald-400/25 bg-zinc-900/78 text-emerald-100"
          : "border-white/12 bg-zinc-900/78 text-zinc-200",
      )}
      title="定位狀態"
    >
      <p className="truncate font-medium">{headline}</p>
      <p className="truncate tabular-nums text-zinc-300">
        {live
          ? `${formatCoord(vehicle.lat)}, ${formatCoord(vehicle.lng)}`
          : "等待裝置座標"}
      </p>
      <p className="truncate text-zinc-500">
        {formatClock(vehicle.fixedAt)} · {permissionLabel(permission)}
        {error ? ` · ${error}` : ""}
      </p>
    </div>
  );
}
