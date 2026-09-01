"use client";

import { CornerUpRight, Navigation } from "lucide-react";
import { formatDistance } from "@/lib/format";
import type { NavigationManeuver } from "@/types/domain";

export function NavigationBanner({
  maneuver,
}: {
  maneuver: NavigationManeuver | null;
}) {
  if (!maneuver) {
    return (
      <div className="pointer-events-none rounded-2xl border border-white/10 bg-black/45 px-4 py-3 text-sm text-zinc-300 backdrop-blur-md">
        導航資訊載入中…
      </div>
    );
  }

  return (
    <div className="pointer-events-none w-full max-w-xl rounded-2xl border border-cyan-300/20 bg-black/55 px-4 py-3 text-white shadow-[0_8px_40px_rgba(0,0,0,0.45)] backdrop-blur-xl">
      <div className="flex items-center gap-3">
        <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-cyan-400/15 text-cyan-300">
          <CornerUpRight className="size-6" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] tracking-wide text-cyan-200/80 uppercase">
            智慧導航 · 示範路線
          </p>
          <p className="truncate text-lg font-semibold tracking-tight">
            {formatDistance(maneuver.distanceMeters)}後{maneuver.action}
          </p>
          <p className="truncate text-sm text-zinc-300">
            {maneuver.roadName}
            <span className="text-zinc-500"> · {maneuver.hint}</span>
          </p>
        </div>
        <div className="hidden shrink-0 text-right sm:block">
          <p className="flex items-center justify-end gap-1 text-sm text-cyan-100">
            <Navigation className="size-3.5" />
            {maneuver.remainingKm.toFixed(1)} 公里
          </p>
          <p className="text-xs text-zinc-400">約 {maneuver.etaMinutes} 分鐘</p>
        </div>
      </div>
    </div>
  );
}
