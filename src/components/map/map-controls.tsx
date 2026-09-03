"use client";

import type { ReactNode } from "react";
import { LocateFixed } from "lucide-react";
import { MapStyleMenu } from "@/components/overlay/map-style-menu";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type {
  CameraMode,
  FollowOrientation,
  GpsStatus,
  MapDisplayMode,
} from "@/types/domain";

type MapControlsProps = {
  cameraMode: CameraMode;
  followOrientation: FollowOrientation;
  followVehicle: boolean;
  gpsStatus: GpsStatus;
  mapDisplayMode: MapDisplayMode;
  styleMenuOpen: boolean;
  onLocate: () => void;
  onToggleCamera: () => void;
  onMapDisplayMode: (mode: MapDisplayMode) => void;
  onToggleStyleMenu: () => void;
};

export function MapControls({
  cameraMode,
  followOrientation,
  followVehicle,
  gpsStatus,
  mapDisplayMode,
  styleMenuOpen,
  onLocate,
  onToggleCamera,
  onMapDisplayMode,
  onToggleStyleMenu,
}: MapControlsProps) {
  const locating = gpsStatus === "locating";
  const locateLabel = !followVehicle
    ? "回到定位並車頭向上"
    : followOrientation === "heading-up"
      ? "切換北方朝上"
      : "切換車頭向上";

  return (
    <div className="pointer-events-auto flex flex-col items-end gap-2.5">
      <ControlButton
        label={locateLabel}
        onClick={onLocate}
        active={followVehicle}
      >
        <LocateFixed className={cn("size-5", locating && "animate-pulse")} />
      </ControlButton>
      <ControlButton
        label={cameraMode === "3d" ? "切換 2D" : "切換 3D"}
        onClick={onToggleCamera}
        active={cameraMode === "3d"}
      >
        <span className="text-[18px] font-bold leading-none tracking-tight">
          {cameraMode === "3d" ? "3D" : "2D"}
        </span>
      </ControlButton>
      <MapStyleMenu
        mode={mapDisplayMode}
        open={styleMenuOpen}
        onChange={onMapDisplayMode}
        onToggle={onToggleStyleMenu}
      />
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
