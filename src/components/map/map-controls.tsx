"use client";

import type { ReactNode } from "react";
import { LayoutGrid, LocateFixed, Settings } from "lucide-react";
import { HeadingCompass } from "@/components/overlay/heading-compass";
import { MapStyleMenu } from "@/components/overlay/map-style-menu";
import { Button } from "@/components/ui/button";
import {
  mapControlButtonClass,
  mapControlTone,
} from "@/lib/map-control-tone";
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
  heading: number;
  mapDisplayMode: MapDisplayMode;
  pendingMapDisplayMode?: MapDisplayMode | null;
  styleMenuOpen: boolean;
  toolsDrawerOpen?: boolean;
  navigating?: boolean;
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
  heading,
  mapDisplayMode,
  pendingMapDisplayMode = null,
  styleMenuOpen,
  toolsDrawerOpen = false,
  navigating = false,
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
  const tone = mapControlTone(mapDisplayMode);

  if (navigating) {
    return (
      <div className="pointer-events-auto flex flex-col items-end gap-2.5">
        <HeadingCompass
          heading={heading}
          orientation={followOrientation}
          onClick={onLocate}
        />
        <LabeledRail label="圖層" tone={tone}>
          <MapStyleMenu
            mode={mapDisplayMode}
            pendingMode={pendingMapDisplayMode}
            open={styleMenuOpen}
            tone={tone}
            onChange={onMapDisplayMode}
            onToggle={onToggleStyleMenu}
          />
        </LabeledRail>
        <LabeledRail label="2D/3D" tone={tone}>
          <ControlButton
            label={cameraMode === "3d" ? "切換 2D" : "切換 3D"}
            onClick={onToggleCamera}
            active={cameraMode === "3d"}
            tone={tone}
          >
            <span className="text-[18px] font-bold leading-none tracking-tight">
              {cameraMode === "3d" ? "3D" : "2D"}
            </span>
          </ControlButton>
        </LabeledRail>
        {onToggleToolsDrawer ? (
          <LabeledRail label="設定" tone={tone}>
            <ControlButton
              label={toolsDrawerOpen ? "收合功能列" : "開啟功能列"}
              onClick={onToggleToolsDrawer}
              active={toolsDrawerOpen}
              expanded={toolsDrawerOpen}
              controls="navpilot-function-drawer"
              tone={tone}
            >
              <Settings className="size-5" />
            </ControlButton>
          </LabeledRail>
        ) : null}
      </div>
    );
  }

  return (
    <div className="pointer-events-auto flex flex-col items-end gap-2.5">
      <ControlButton
        label={locateLabel}
        onClick={onLocate}
        active={followVehicle}
        tone={tone}
      >
        <LocateFixed className={cn("size-5", locating && "animate-pulse")} />
      </ControlButton>
      <ControlButton
        label={cameraMode === "3d" ? "切換 2D" : "切換 3D"}
        onClick={onToggleCamera}
        active={cameraMode === "3d"}
        tone={tone}
      >
        <span className="text-[18px] font-bold leading-none tracking-tight">
          {cameraMode === "3d" ? "3D" : "2D"}
        </span>
      </ControlButton>
      <MapStyleMenu
        mode={mapDisplayMode}
        pendingMode={pendingMapDisplayMode}
        open={styleMenuOpen}
        tone={tone}
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
          tone={tone}
        >
          <LayoutGrid className="size-5" />
        </ControlButton>
      ) : null}
    </div>
  );
}

function LabeledRail({
  label,
  children,
}: {
  label: string;
  tone: ReturnType<typeof mapControlTone>;
  children: ReactNode;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="rounded-full bg-white/92 px-1.5 py-0.5 text-[11px] font-semibold tracking-wide text-[#1F2937] shadow-sm [text-shadow:0_0_2px_#fff]">
        {label}
      </span>
      {children}
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
  tone,
}: {
  children: ReactNode;
  label: string;
  onClick: () => void;
  active?: boolean;
  expanded?: boolean;
  controls?: string;
  tone: ReturnType<typeof mapControlTone>;
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
        "size-12 rounded-full backdrop-blur-md disabled:border-zinc-700 disabled:bg-zinc-900/80 disabled:text-zinc-500 touch-manipulation",
        mapControlButtonClass(tone, active),
      )}
    >
      {children}
    </Button>
  );
}
