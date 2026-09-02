"use client";

import { CornerUpRight, Navigation } from "lucide-react";
import { formatDistance } from "@/lib/format";
import type { NavigationManeuver } from "@/types/domain";

export function NavigationBanner({
  maneuver,
  destinationLabel,
}: {
  maneuver: NavigationManeuver | null;
  destinationLabel?: string | null;
}) {
  if (!maneuver) {
    return (
      <div className="pointer-events-none rounded-2xl border border-white/10 bg-black/45 px-3 py-2 text-sm text-zinc-300 backdrop-blur-md">
        輸入地址後顯示導航路線
      </div>
    );
  }

  return (
    <div className="pointer-events-none w-full max-w-xl rounded-2xl border border-cyan-300/20 bg-black/55 px-3 py-2 text-white shadow-[0_8px_40px_rgba(0,0,0,0.45)] backdrop-blur-xl sm:px-4 sm:py-3">
      <div className="flex items-center gap-2.5 sm:gap-3">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-cyan-400/15 text-cyan-300 sm:size-12 sm:rounded-2xl">
          <CornerUpRight className="size-5 sm:size-6" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="hidden text-[11px] tracking-wide text-cyan-200/80 uppercase sm:block">
            {destinationLabel ? `前往 ${destinationLabel}` : "智慧導航 · 示範路線"}
          </p>
          <p className="truncate text-base font-semibold tracking-tight sm:text-lg">
            {formatDistance(maneuver.distanceMeters)}後{maneuver.action}
          </p>
          <p className="truncate text-xs text-zinc-300 sm:text-sm">
            {maneuver.roadName}
            <span className="text-zinc-500"> · {maneuver.hint}</span>
          </p>
        </div>
        <div className="hidden shrink-0 text-right sm:block">
          <p className="flex items-center justify-end gap-1 text-sm text-cyan-100">
            <Navigation className="size-3.5" />
            {maneuver.remainingKm >= 10
              ? `${maneuver.remainingKm.toFixed(0)} 公里`
              : `${maneuver.remainingKm.toFixed(1)} 公里`}
          </p>
          <p className="text-xs text-zinc-400">約 {maneuver.etaMinutes} 分鐘</p>
        </div>
      </div>
    </div>
  );
}
