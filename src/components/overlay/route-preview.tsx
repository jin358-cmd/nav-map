"use client";

import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatEtaClock, travelModeLabel } from "@/lib/travel-mode";
import { cn } from "@/lib/utils";
import type { NavigationManeuver, RouteDestination, TravelMode } from "@/types/domain";

export function RouteConfirmBar({
  destination,
  maneuver,
  travelMode,
  durationSeconds,
  distanceMeters,
  rerouting = false,
  motorcycleUnsupported = false,
  onTravelMode,
  onStartNav,
  onClear,
  onNearbyParking,
}: {
  destination: RouteDestination;
  maneuver: NavigationManeuver | null;
  travelMode: TravelMode;
  durationSeconds: number | null;
  distanceMeters: number | null;
  rerouting?: boolean;
  motorcycleUnsupported?: boolean;
  onTravelMode: (mode: TravelMode) => void;
  onStartNav: () => void;
  onClear: () => void;
  onNearbyParking?: () => void;
}) {
  const remainingKm =
    distanceMeters != null
      ? distanceMeters / 1000
      : maneuver?.remainingKm;
  const remaining =
    remainingKm != null
      ? remainingKm >= 10
        ? `${remainingKm.toFixed(0)} 公里`
        : `${remainingKm.toFixed(1)} 公里`
      : null;
  const etaMinutes =
    durationSeconds != null
      ? Math.max(1, Math.round(durationSeconds / 60))
      : maneuver?.etaMinutes;
  const etaClock =
    durationSeconds != null ? formatEtaClock(durationSeconds) : null;

  return (
    <div className="pointer-events-auto w-full rounded-2xl border border-cyan-300/20 bg-black/74 shadow-[0_10px_40px_rgba(0,0,0,0.5)] backdrop-blur-xl">
      <div className="flex w-full flex-col gap-3 px-3.5 py-3 sm:px-4 sm:py-3.5">
        <div className="w-full min-w-0">
          <p className="text-lg leading-tight font-bold tracking-tight text-white sm:text-2xl">
            {destination.label}
          </p>
          {destination.address ? (
            <p className="mt-1 w-full text-sm leading-snug text-zinc-300 sm:text-base">
              {destination.address}
            </p>
          ) : null}
          <div className="mt-2 flex gap-1.5">
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
          <p className="mt-1.5 w-full text-sm font-medium text-cyan-200 sm:text-base">
            {rerouting
              ? "正在重新規劃路線…"
              : motorcycleUnsupported && travelMode === "motorcycle"
                ? "機車模式尚未設定（NOT CONFIGURED）"
                : `${travelModeLabel(travelMode)} · ${remaining ?? "計算距離中"}${
                    etaMinutes != null ? ` · 約 ${etaMinutes} 分鐘` : ""
                  }${etaClock ? ` · 預計 ${etaClock} 抵達` : ""}`}
          </p>
        </div>
        <div className="flex w-full items-center gap-2">
          {onNearbyParking ? (
            <Button
              type="button"
              variant="outline"
              onClick={onNearbyParking}
              className="h-12 min-h-12 rounded-xl border-emerald-300/30 bg-emerald-500/15 text-emerald-100 hover:bg-emerald-500/25"
            >
              附近停車
            </Button>
          ) : null}
          <Button
            type="button"
            onClick={onStartNav}
            disabled={rerouting || (motorcycleUnsupported && travelMode === "motorcycle")}
            className="h-12 min-h-12 flex-1 rounded-xl bg-cyan-400 text-base font-semibold text-[#041016] hover:bg-cyan-300 sm:text-lg"
          >
            開始導航
          </Button>
          <Button
            type="button"
            variant="ghost"
            aria-label="取消路線，重新搜尋"
            onClick={onClear}
            className="size-12 shrink-0 text-zinc-300 hover:bg-white/10 hover:text-white"
          >
            <X className="size-6" />
          </Button>
        </div>
      </div>
    </div>
  );
}
