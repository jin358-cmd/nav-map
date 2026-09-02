"use client";

import type { LucideIcon } from "lucide-react";
import {
  ArrowUp,
  CornerUpLeft,
  CornerUpRight,
  Flag,
  GitFork,
  Navigation,
  RotateCw,
  Undo2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatDistance } from "@/lib/format";
import { instructionForStep } from "@/lib/osrm-maneuver";
import type { NavigationManeuver, RouteDestination, RouteStep } from "@/types/domain";

function stepIcon(step: RouteStep): LucideIcon {
  if (step.type === "arrive") return Flag;
  if (step.type === "depart") return Navigation;
  if (
    step.type.includes("roundabout") ||
    step.type === "rotary" ||
    step.type === "exit rotary"
  ) {
    return RotateCw;
  }
  if (step.type === "fork") return GitFork;
  const modifier = step.modifier ?? "";
  if (modifier.includes("uturn")) return Undo2;
  if (modifier.includes("left")) return CornerUpLeft;
  if (modifier.includes("right")) return CornerUpRight;
  return ArrowUp;
}

export function RoutePreview({
  destination,
  maneuver,
  steps,
  onStartNav,
  onClear,
}: {
  destination: RouteDestination;
  maneuver: NavigationManeuver | null;
  steps: RouteStep[];
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
    <div className="pointer-events-auto w-full max-w-xl rounded-2xl border border-cyan-300/20 bg-black/70 shadow-[0_10px_40px_rgba(0,0,0,0.5)] backdrop-blur-xl">
      <div className="flex items-start gap-2 px-3 py-2.5 sm:px-3.5">
        <div className="min-w-0 flex-1">
          <p className="text-[11px] tracking-wide text-cyan-200/85">
            全線路線預覽
          </p>
          <p className="truncate text-base font-semibold tracking-tight text-white">
            {destination.label}
          </p>
          <p className="truncate text-xs text-zinc-400">
            {remaining ?? "計算距離中"}
            {eta != null ? ` · 約 ${eta} 分鐘` : ""}
            {steps.length ? ` · ${steps.length} 個路口提示` : ""}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <Button
            type="button"
            onClick={onStartNav}
            className="h-8 rounded-lg bg-cyan-400 px-3 text-[12px] font-semibold text-[#041016] hover:bg-cyan-300"
          >
            確認
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="取消路線，重新搜尋"
            onClick={onClear}
            className="size-8 text-zinc-300 hover:bg-white/10 hover:text-white"
          >
            <X className="size-4" />
          </Button>
        </div>
      </div>

      {steps.length === 0 ? (
        <p className="border-t border-white/8 px-3 py-3 text-sm text-zinc-400">
          此路線沒有路口分段資料。
        </p>
      ) : (
        <ol className="route-preview-list max-h-40 overflow-y-auto overscroll-contain border-t border-white/8 sm:max-h-52">
          {steps.map((step) => {
            const Icon = stepIcon(step);
            return (
              <li
                key={step.id}
                className="flex items-start gap-2.5 px-3 py-2 text-sm odd:bg-white/[0.03]"
              >
                <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg bg-white/8 text-zinc-300">
                  <Icon className="size-3.5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block leading-snug text-zinc-100">
                    {instructionForStep(step, destination.label)}
                  </span>
                  {step.type !== "depart" && step.type !== "arrive" && step.distanceMeters >= 80 ? (
                    <span className="block text-[11px] text-zinc-500">
                      此段約 {formatDistance(step.distanceMeters)}
                    </span>
                  ) : null}
                </span>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
