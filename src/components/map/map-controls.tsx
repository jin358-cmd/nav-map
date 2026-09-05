"use client";

import type { ReactNode } from "react";
import { LayoutGrid, LocateFixed, Settings, Volume2, VolumeX, Waypoints } from "lucide-react";
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
  voiceEnabled?: boolean;
  trafficVisible?: boolean;
  onLocate: () => void;
  onToggleCamera: () => void;
  onMapDisplayMode: (mode: MapDisplayMode) => void;
  onToggleStyleMenu: () => void;
  onToggleToolsDrawer?: () => void;
  onToggleVoice?: () => void;
  onToggleTraffic?: () => void;
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
  voiceEnabled = true,
  trafficVisible = true,
  onLocate,
  onToggleCamera,
  onMapDisplayMode,
  onToggleStyleMenu,
  onToggleToolsDrawer,
  onToggleVoice,
  onToggleTraffic,
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
        {onToggleVoice ? (
          <LabeledRail label="聲音" tone={tone}>
            <ControlButton
              label={voiceEnabled ? "關閉語音" : "開啟語音"}
              onClick={onToggleVoice}
              active={voiceEnabled}
              tone={tone}
            >
              {voiceEnabled ? (
                <Volume2 className="size-5" />
              ) : (
                <VolumeX className="size-5" />
              )}
            </ControlButton>
          </LabeledRail>
        ) : null}
        {onToggleTraffic ? (
          <LabeledRail label="路況" tone={tone}>
            <ControlButton
              label={trafficVisible ? "隱藏路況" : "顯示路況"}
              onClick={onToggleTraffic}
              active={trafficVisible}
              tone={tone}
            >
              <Waypoints className="size-5" />
            </ControlButton>
          </LabeledRail>
        ) : null}
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
  tone,
  children,
}: {
  label: string;
  tone: ReturnType<typeof mapControlTone>;
  children: ReactNode;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <span
        className={cn(
          "text-[11px] font-medium tracking-wide",
          tone === "light"
            ? "text-[#1F2937] [text-shadow:0_0_2px_#fff,0_1px_2px_rgba(255,255,255,0.9)]"
            : "text-white [text-shadow:0_0_2px_#000,0_1px_2px_rgba(0,0,0,0.88)]",
        )}
      >
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
