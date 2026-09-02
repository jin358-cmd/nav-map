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
import { cn } from "@/lib/utils";
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
  navigating,
  onStartNav,
  onClear,
}: {
  destination: RouteDestination;
  maneuver: NavigationManeuver | null;
  steps: RouteStep[];
  navigating: boolean;
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
  const nextIndex = steps.findIndex(
    (step) => step.type !== "depart" && step.type !== "arrive",
  );

  return (
    <div className="pointer-events-auto w-full max-w-xl rounded-2xl border border-cyan-300/20 bg-black/70 shadow-[0_10px_40px_rgba(0,0,0,0.5)] backdrop-blur-xl">
      <div className="flex items-start gap-2 px-3 py-2.5 sm:px-3.5">
        <div className="min-w-0 flex-1">
          <p className="text-[11px] tracking-wide text-cyan-200/85">
            {navigating ? "導航中 · 全線路口" : "全線路線預覽"}
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
          {navigating ? (
            <span className="rounded-lg border border-cyan-300/25 bg-cyan-400/15 px-2 py-1 text-[11px] text-cyan-100">
              跟隨中
            </span>
          ) : (
            <Button
              type="button"
              onClick={onStartNav}
              className="h-8 rounded-lg bg-cyan-400/20 px-2.5 text-[12px] text-cyan-50 hover:bg-cyan-400/30"
            >
              開始導航
            </Button>
          )}
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
          {steps.map((step, index) => {
            const Icon = stepIcon(step);
            const active = navigating && (index === nextIndex || (nextIndex < 0 && index === 0));
            return (
              <li
                key={step.id}
                className={cn(
                  "flex items-start gap-2.5 px-3 py-2 text-sm",
                  active ? "bg-cyan-400/12" : "odd:bg-white/[0.03]",
                )}
              >
                <span
                  className={cn(
                    "mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg",
                    active
                      ? "bg-cyan-400/25 text-cyan-100"
                      : "bg-white/8 text-zinc-300",
                  )}
                >
                  <Icon className="size-3.5" />
                </span>
                <span className="min-w-0 flex-1">
                  {active ? (
                    <span className="mb-0.5 block text-[10px] tracking-wide text-cyan-200/90">
                      下一步
                    </span>
                  ) : null}
                  <span
                    className={cn(
                      "block leading-snug",
                      active ? "font-semibold text-white" : "text-zinc-100",
                    )}
                  >
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
