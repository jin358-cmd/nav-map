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
    <div className="pointer-events-auto w-fit max-w-[min(22rem,calc(100vw-5.5rem))] rounded-2xl border border-cyan-300/20 bg-black/70 shadow-[0_10px_40px_rgba(0,0,0,0.5)] backdrop-blur-xl">
      <div className="flex items-center gap-2 px-3 py-2">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold tracking-tight text-white">
            {destination.label}
          </p>
          <p className="truncate text-[11px] text-zinc-400">
            {rerouting
              ? "正在更新路線…"
              : `${remaining ?? "計算距離中"}${eta != null ? ` · 約 ${eta} 分鐘` : ""}`}
          </p>
        </div>
        <Button
          type="button"
          onClick={onStartNav}
          disabled={rerouting}
          className="h-8 shrink-0 rounded-lg bg-cyan-400 px-3 text-[12px] font-semibold text-[#041016] hover:bg-cyan-300"
        >
          確認
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label="取消路線，重新搜尋"
          onClick={onClear}
          className="size-8 shrink-0 text-zinc-300 hover:bg-white/10 hover:text-white"
        >
          <X className="size-4" />
        </Button>
      </div>
    </div>
  );
}
