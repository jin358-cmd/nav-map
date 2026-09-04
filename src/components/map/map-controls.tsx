"use client";

import type { ReactNode } from "react";
import { LayoutGrid, LocateFixed } from "lucide-react";
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
  toolsDrawerOpen?: boolean;
  onLocate: () => void;
  onToggleCamera: () => void;
  onMapDisplayMode: (mode: MapDisplayMode) => void;
  onToggleStyleMenu: () => void;
  onToggleToolsDrawer?: () => void;
};

export function MapControls({
  cameraMode,
  followOrientation,
  followVehicle,
  gpsStatus,
  mapDisplayMode,
  styleMenuOpen,
  toolsDrawerOpen = false,
  onLocate,
  onToggleCamera,
  onMapDisplayMode,
  onToggleStyleMenu,
  onToggleToolsDrawer,
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
      {onToggleToolsDrawer ? (
        <ControlButton
          label={toolsDrawerOpen ? "收合功能列" : "開啟功能列"}
          onClick={onToggleToolsDrawer}
          active={toolsDrawerOpen}
          expanded={toolsDrawerOpen}
          controls="navpilot-function-drawer"
        >
          <LayoutGrid className="size-5" />
        </ControlButton>
      ) : null}
    </div>
  );
}

function ControlButton({
  children,
  label,
  onClick,
  active,
  expanded,
  controls,
}: {
  children: ReactNode;
  label: string;
  onClick: () => void;
  active?: boolean;
  expanded?: boolean;
  controls?: string;
}) {
  return (
    <Button
      type="button"
      variant="outline"
      size="icon-lg"
      aria-label={label}
      title={label}
      aria-expanded={expanded}
      aria-controls={controls}
      onClick={onClick}
      className={cn(
        "size-12 rounded-2xl border-zinc-500/55 bg-zinc-800/92 text-zinc-100 shadow-lg backdrop-blur-md hover:bg-zinc-700 disabled:border-zinc-700 disabled:bg-zinc-900/80 disabled:text-zinc-500 touch-manipulation",
        active && "border-cyan-300/80 bg-zinc-700 text-cyan-200",
      )}
    >
      {children}
    </Button>
  );
}
