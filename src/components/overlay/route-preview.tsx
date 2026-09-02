"use client";

import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { NavigationManeuver, RouteDestination } from "@/types/domain";

export function RouteConfirmBar({
  destination,
  maneuver,
  rerouting = false,
  onStartNav,
  onClear,
}: {
  destination: RouteDestination;
  maneuver: NavigationManeuver | null;
  rerouting?: boolean;
  onStartNav: () => void;
  onClear: () => void;
}) {
  const remaining =
    maneuver?.remainingKm != null
      ? maneuver.remainingKm >= 10
        ? `${maneuver.remainingKm.toFixed(0)} 公里`
        : `${maneuver.remainingKm.toFixed(1)} 公里`
      : null;
  const eta = maneuver?.etaMinutes;

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
          <p className="mt-1.5 w-full text-sm font-medium text-cyan-200 sm:text-base">
            {rerouting
              ? "正在更新路線…"
              : `${remaining ?? "計算距離中"}${eta != null ? ` · 約 ${eta} 分鐘` : ""}`}
          </p>
        </div>
        <div className="flex w-full items-center gap-2">
          <Button
            type="button"
            onClick={onStartNav}
            disabled={rerouting}
            className="h-12 min-h-12 flex-1 rounded-xl bg-cyan-400 text-base font-semibold text-[#041016] hover:bg-cyan-300 sm:text-lg"
          >
            確認
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
