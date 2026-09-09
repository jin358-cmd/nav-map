"use client";

import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import { ChevronLeft, LayoutGrid, LocateFixed, ShoppingCart } from "lucide-react";
import { MapStyleMenu } from "@/components/overlay/map-style-menu";
import { Button } from "@/components/ui/button";
import {
  mapControlButtonClass,
  mapControlTone,
  mapHeadingUpButtonClass,
} from "@/lib/map-control-tone";
import { cn } from "@/lib/utils";
import type {
  CameraMode,
  FollowOrientation,
  GpsStatus,
  MapDisplayMode,
} from "@/types/domain";

const RAIL_IDLE_COLLAPSE_MS = 4500;
const SWIPE_EXPAND_PX = -22;
const SWIPE_COLLAPSE_PX = 32;

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
  poiMenuOpen?: boolean;
  poiLayersLoading?: boolean;
  poiLayersProgress?: number;
  navigating?: boolean;
  toolsDrawer?: ReactNode;
  onLocate: () => void;
  onToggleCamera: () => void;
  onMapDisplayMode: (mode: MapDisplayMode) => void;
  onToggleStyleMenu: () => void;
  onToggleToolsDrawer?: () => void;
  onTogglePoiMenu?: () => void;
};

export function MapControls({
  cameraMode,
  followOrientation,
  followVehicle,
  gpsStatus,
  mapDisplayMode,
  pendingMapDisplayMode = null,
  styleMenuOpen,
  toolsDrawerOpen = false,
  poiMenuOpen = false,
  poiLayersLoading = false,
  poiLayersProgress = 0,
  navigating = false,
  toolsDrawer = null,
  onLocate,
  onToggleCamera,
  onMapDisplayMode,
  onToggleStyleMenu,
  onToggleToolsDrawer,
  onTogglePoiMenu,
}: MapControlsProps) {
  const locating = gpsStatus === "locating";
  const northUp = followVehicle && followOrientation === "north-up";
  const headingUp = followVehicle && followOrientation === "heading-up";
  const locateLabel = !followVehicle
    ? followOrientation === "heading-up"
      ? "回到定位並對準車頭方向"
      : "回到定位並北方朝上"
    : northUp
      ? "目前北方朝上。點擊切換車頭向上"
      : "目前車頭向上，點擊切換北方朝上";
  const tone = mapControlTone(pendingMapDisplayMode ?? mapDisplayMode);
  const flyoutOpen = styleMenuOpen || toolsDrawerOpen || poiMenuOpen;
  const [wasNavigating, setWasNavigating] = useState(navigating);
  const [railRevealed, setRailRevealed] = useState(false);
  const [idleToken, setIdleToken] = useState(0);
  const gestureRef = useRef<{
    x: number;
    y: number;
    pointerId: number;
    fromPeek: boolean;
  } | null>(null);
  const suppressClickRef = useRef(false);

  if (wasNavigating !== navigating) {
    setWasNavigating(navigating);
    setRailRevealed(false);
  }

  const collapsed = Boolean(navigating) && !railRevealed && !flyoutOpen;

  useEffect(() => {
    if (!navigating || !railRevealed || flyoutOpen) return;
    const id = window.setTimeout(
      () => setRailRevealed(false),
      RAIL_IDLE_COLLAPSE_MS,
    );
    return () => window.clearTimeout(id);
  }, [flyoutOpen, idleToken, navigating, railRevealed]);

  useEffect(() => {
    if (!navigating || !railRevealed || flyoutOpen) return;
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (!target) return;
      const rail = document.querySelector(".hud-anchor-rail");
      if (rail?.contains(target)) return;
      setRailRevealed(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [flyoutOpen, navigating, railRevealed]);

  const bumpIdle = () => setIdleToken((value) => value + 1);

  const expandRail = () => {
    setRailRevealed(true);
    bumpIdle();
  };

  const collapseRail = () => {
    if (!navigating || flyoutOpen) return;
    setRailRevealed(false);
  };

  const onRailPointerDown = (
    event: ReactPointerEvent<HTMLElement>,
    fromPeek: boolean,
  ) => {
    gestureRef.current = {
      x: event.clientX,
      y: event.clientY,
      pointerId: event.pointerId,
      fromPeek,
    };
    if (fromPeek) {
      event.currentTarget.setPointerCapture(event.pointerId);
    }
    if (!collapsed) bumpIdle();
  };

  const onRailPointerUp = (event: ReactPointerEvent<HTMLElement>) => {
    const gesture = gestureRef.current;
    if (!gesture || gesture.pointerId !== event.pointerId) return;
    gestureRef.current = null;
    const dx = event.clientX - gesture.x;
    const dy = event.clientY - gesture.y;
    const horizontal = Math.abs(dx) >= Math.abs(dy);
    if (collapsed) {
      if (
        (horizontal && dx <= SWIPE_EXPAND_PX) ||
        (Math.abs(dx) < 12 && Math.abs(dy) < 12)
      ) {
        expandRail();
      }
      return;
    }
    if (navigating && horizontal && dx >= SWIPE_COLLAPSE_PX && !flyoutOpen) {
      suppressClickRef.current = true;
      collapseRail();
    }
  };

  const onRailClickCapture = (event: ReactMouseEvent<HTMLDivElement>) => {
    if (!suppressClickRef.current) return;
    suppressClickRef.current = false;
    event.preventDefault();
    event.stopPropagation();
  };

  return (
    <div
      className={cn(
        "hud-rail pointer-events-auto",
        collapsed && "hud-rail--collapsed",
      )}
      data-nav-rail={collapsed ? "peek" : "open"}
      onPointerDown={(event) => onRailPointerDown(event, false)}
      onPointerUp={onRailPointerUp}
      onPointerCancel={() => {
        gestureRef.current = null;
      }}
      onClickCapture={onRailClickCapture}
    >
      <button
        type="button"
        className="hud-rail-peek"
        aria-label="展開功能鍵"
        title="向左撥或點一下展開功能鍵"
        aria-expanded={!collapsed}
        tabIndex={collapsed ? 0 : -1}
        onPointerDown={(event) => {
          event.stopPropagation();
          onRailPointerDown(event, true);
        }}
        onPointerUp={(event) => {
          event.stopPropagation();
          onRailPointerUp(event);
        }}
        onClick={(event) => {
          event.stopPropagation();
          if (collapsed) expandRail();
        }}
      >
        <span className="hud-rail-peek__bar" aria-hidden />
        <ChevronLeft className="hud-rail-peek__chevron" strokeWidth={2.75} />
      </button>
      <div className="hud-rail-buttons" aria-hidden={collapsed} inert={collapsed}>
      {onTogglePoiMenu ? (
        <ControlButton
          label={
            poiLayersLoading
              ? "生活圈圖層讀取中"
              : poiMenuOpen
                ? "收合生活圈圖層"
                : "開啟生活圈圖層"
          }
          onClick={onTogglePoiMenu}
          active={poiMenuOpen || poiLayersLoading}
          expanded={poiMenuOpen}
          controls="navpilot-poi-layers"
          tone={tone}
        >
          {poiLayersLoading ? (
            <span className="relative inline-flex size-6 items-center justify-center">
              <ShoppingCart className="size-6" strokeWidth={2.5} />
              <span
                className="poi-layer-read-pie poi-layer-read-pie--icon-ring"
                style={
                  { "--poi-progress": poiLayersProgress } as CSSProperties
                }
                aria-hidden
              />
            </span>
          ) : (
            <ShoppingCart className="size-6" strokeWidth={2.5} />
          )}
        </ControlButton>
      ) : null}
      <ControlButton
        label={locateLabel}
        onClick={onLocate}
        active={northUp}
        pressed={followVehicle}
        tone={tone}
        className={headingUp ? mapHeadingUpButtonClass(tone) : undefined}
      >
        <LocateFixed
          className={cn("size-6", locating && "animate-pulse")}
          strokeWidth={2.5}
        />
      </ControlButton>
      <ControlButton
        label={cameraMode === "3d" ? "目前 3D，點擊切換 2D" : "目前 2D，點擊切換 3D"}
        onClick={onToggleCamera}
        active={cameraMode === "3d"}
        pressed={cameraMode === "3d"}
        tone={tone}
        className={
          cameraMode === "2d"
            ? tone === "dark"
              ? "!border-[#67e8f9] !bg-[#155e75] !text-[#ecfeff]"
              : tone === "satellite"
                ? "border-[#111827] bg-zinc-800 text-white"
                : "border-[#111827] bg-zinc-800 text-white"
            : undefined
        }
      >
        <span className="text-[1.05rem] font-black leading-none tracking-tight">
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
        <div className="relative">
          <div
            className={cn(
              "absolute right-full bottom-0 z-30 mr-2",
              !toolsDrawerOpen && "pointer-events-none",
            )}
          >
            <div
              id="navpilot-function-drawer"
              className={cn(
                "function-drawer",
                !toolsDrawerOpen && "function-drawer--closed",
              )}
            >
              {toolsDrawer}
            </div>
          </div>
          <ControlButton
            label={toolsDrawerOpen ? "收合功能列" : "開啟功能列"}
            onClick={onToggleToolsDrawer}
            active={toolsDrawerOpen}
            expanded={toolsDrawerOpen}
            controls="navpilot-function-drawer"
            tone={tone}
          >
            <LayoutGrid className="size-6" strokeWidth={2.5} />
          </ControlButton>
        </div>
      ) : null}
      </div>
    </div>
  );
}

function ControlButton({
  children,
  label,
  onClick,
  active,
  pressed,
  expanded,
  controls,
  tone,
  className,
}: {
  children: ReactNode;
  label: string;
  onClick: () => void;
  active?: boolean;
  pressed?: boolean;
  expanded?: boolean;
  controls?: string;
  tone: ReturnType<typeof mapControlTone>;
  className?: string;
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-lg"
      aria-label={label}
      title={label}
      aria-pressed={pressed}
      aria-expanded={expanded}
      aria-controls={controls}
      onClick={onClick}
      className={cn(
        "size-12 rounded-full backdrop-blur-md disabled:border-zinc-700 disabled:bg-zinc-900/80 disabled:text-zinc-500 touch-manipulation",
        mapControlButtonClass(tone, active),
        className,
      )}
    >
      {children}
    </Button>
  );
}
