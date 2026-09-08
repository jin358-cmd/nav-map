"use client";

import { Heart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { HudCloseButton } from "@/components/overlay/hud-close-button";
import { formatDistance } from "@/lib/format";
import {
  formatChainStoreName,
  formatConfirmLocationLine,
} from "@/lib/geocoding/format-taiwan-display-address";
import { formatEtaClock, travelModeLabel } from "@/lib/travel-mode";
import { cn } from "@/lib/utils";
import type { NavigationManeuver, RouteDestination, TravelMode } from "@/types/domain";

function formatCoords(location: RouteDestination["location"]) {
  if (!Number.isFinite(location.lat) || !Number.isFinite(location.lng)) {
    return "座標未提供";
  }
  return `${location.lat.toFixed(6)}, ${location.lng.toFixed(6)}`;
}

export function RouteConfirmBar({
  destination,
  maneuver,
  travelMode,
  durationSeconds,
  distanceMeters,
  rerouting = false,
  motorcycleUnsupported = false,
  error = null,
  onTravelMode,
  onStartNav,
  onClear,
  favorite = false,
  onToggleFavorite,
}: {
  destination: RouteDestination;
  maneuver: NavigationManeuver | null;
  travelMode: TravelMode;
  durationSeconds: number | null;
  distanceMeters: number | null;
  rerouting?: boolean;
  motorcycleUnsupported?: boolean;
  error?: string | null;
  onTravelMode: (mode: TravelMode) => void;
  onStartNav: () => void;
  onClear: () => void;
  favorite?: boolean;
  onToggleFavorite?: () => void;
}) {
  const storeName = formatChainStoreName(
    destination.label,
    destination.branchName,
  );
  const addressLine = formatConfirmLocationLine(
    destination.address,
    storeName,
  );
  const remainingMeters =
    distanceMeters ??
    (maneuver?.remainingKm != null ? maneuver.remainingKm * 1000 : null);
  const distanceLabel =
    remainingMeters != null
      ? formatDistance(remainingMeters)
      : rerouting
        ? "計算距離中"
        : "距離未提供";
  const etaMinutes =
    durationSeconds != null
      ? Math.max(1, Math.round(durationSeconds / 60))
      : maneuver?.etaMinutes;
  const etaClock =
    durationSeconds != null ? formatEtaClock(durationSeconds) : null;

  return (
    <div className="pointer-events-auto mx-auto w-[min(100%,24.5rem)] rounded-2xl border border-cyan-300/20 bg-black/78 shadow-[0_10px_40px_rgba(0,0,0,0.5)] backdrop-blur-xl">
      <div className="flex w-full flex-col gap-2.5 px-3.5 py-3">
        <div className="flex items-start gap-1.5">
          <div className="min-w-0 flex-1">
            <p className="truncate text-lg leading-tight font-bold tracking-tight text-white">
              {storeName}
            </p>
            {addressLine ? (
              <p className="mt-0.5 truncate text-[14px] leading-snug text-zinc-200">
                {addressLine}
              </p>
            ) : null}
            <p className="mt-0.5 truncate text-[14px] leading-snug tabular-nums text-zinc-300">
              <span className="text-base font-semibold text-sky-400">
                {distanceLabel}
              </span>
              {` · ${formatCoords(destination.location)}`}
            </p>
          </div>
          <HudCloseButton label="取消路線，重新搜尋" onClick={onClear} />
        </div>
        <div className="flex gap-1.5">
          {(["car", "motorcycle"] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => onTravelMode(mode)}
              className={cn(
                "h-9 rounded-full px-3 text-sm",
                travelMode === mode
                  ? "bg-cyan-400 text-[#041016]"
                  : "bg-white/8 text-zinc-200",
              )}
            >
              {travelModeLabel(mode)}
            </button>
          ))}
        </div>
        <div className="flex w-full items-center gap-1.5">
          <p
            className={cn(
              "min-w-0 flex-1 truncate text-base font-medium",
              error
                ? "text-amber-200"
                : rerouting || (motorcycleUnsupported && travelMode === "motorcycle")
                  ? "text-cyan-200"
                  : "text-yellow-300",
            )}
          >
            {error
              ? error
              : rerouting
                ? "正在規劃路線…"
                : motorcycleUnsupported && travelMode === "motorcycle"
                  ? "機車模式尚未設定（NOT CONFIGURED）"
                  : (
                      <>
                        <span className="text-zinc-100">
                          {travelModeLabel(travelMode)}
                        </span>
                        {etaMinutes != null ? ` · 約 ${etaMinutes} 分鐘` : ""}
                        {etaClock ? ` · 預計 ${etaClock} 抵達` : ""}
                      </>
                    )}
          </p>
          {onToggleFavorite ? (
            <button
              type="button"
              onClick={onToggleFavorite}
              aria-pressed={favorite}
              aria-label={favorite ? "移出最愛" : "加入最愛"}
              title={favorite ? "移出最愛" : "加入最愛"}
              className="flex size-11 shrink-0 items-center justify-center rounded-full text-rose-300 hover:bg-white/10 hover:text-rose-100 touch-manipulation"
            >
              <Heart
                className={cn("size-7", favorite && "fill-rose-500 text-rose-400")}
                strokeWidth={2.1}
              />
            </button>
          ) : null}
        </div>
        <Button
          type="button"
          onClick={onStartNav}
          disabled={
            rerouting ||
            Boolean(error) ||
            distanceMeters == null ||
            (motorcycleUnsupported && travelMode === "motorcycle")
          }
          className="h-12 min-h-12 w-full rounded-xl bg-cyan-400 text-base font-semibold text-[#041016] hover:bg-cyan-300"
        >
          開始導航
        </Button>
      </div>
    </div>
  );
}
