"use client";

import type { ReactNode } from "react";
import { Compass, LocateFixed, Mountain, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { CameraMode, GpsStatus } from "@/types/domain";

type MapControlsProps = {
  cameraMode: CameraMode;
  gpsStatus: GpsStatus;
  trafficFocus5km: boolean;
  onLocate: () => void;
  onToggleCamera: () => void;
  onRefreshIntel: () => void;
  onToggleTrafficFocus: () => void;
};

export function MapControls({
  cameraMode,
  gpsStatus,
  trafficFocus5km,
  onLocate,
  onToggleCamera,
  onRefreshIntel,
  onToggleTrafficFocus,
}: MapControlsProps) {
  const locating = gpsStatus === "locating";

  return (
    <div className="pointer-events-auto flex flex-col items-end gap-2.5">
      <ControlButton
        label={gpsStatus === "active" ? "GPS 已鎖定" : "定位"}
        onClick={onLocate}
        active={gpsStatus === "active"}
      >
        <LocateFixed className={cn("size-5", locating && "animate-pulse")} />
      </ControlButton>
      <ControlButton
        label={cameraMode === "3d" ? "切換 2D" : "切換 3D"}
        onClick={onToggleCamera}
        active={cameraMode === "3d"}
      >
        {cameraMode === "3d" ? (
          <Mountain className="size-5" />
        ) : (
          <Compass className="size-5" />
        )}
      </ControlButton>
      <ControlButton
        label={trafficFocus5km ? "顯示全部路況" : "只看附近 5 公里路況"}
        onClick={onToggleTrafficFocus}
        active={trafficFocus5km}
      >
        <span className="text-[11px] font-semibold leading-none tracking-tight">
          5km
        </span>
      </ControlButton>
      <ControlButton label="重新整理情報" onClick={onRefreshIntel}>
        <RefreshCw className="size-5" />
      </ControlButton>
    </div>
  );
}

function ControlButton({
  children,
  label,
  onClick,
  active,
}: {
  children: ReactNode;
  label: string;
  onClick: () => void;
  active?: boolean;
}) {
  return (
    <Button
      type="button"
      variant="outline"
      size="icon-lg"
      aria-label={label}
      title={label}
      onClick={onClick}
      className={cn(
        "size-12 rounded-2xl border-white/12 bg-black/55 text-zinc-100 shadow-lg backdrop-blur-md hover:bg-black/70 touch-manipulation",
        active && "border-cyan-300/50 text-cyan-200",
      )}
    >
      {children}
    </Button>
  );
}
