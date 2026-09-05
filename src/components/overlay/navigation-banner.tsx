"use client";

import { forwardRef } from "react";
import { TurnArrowIcon, turnSideFromStep } from "@/components/overlay/turn-arrow-icon";
import { formatDistance } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { RouteStep } from "@/types/domain";

function shortTurn(step: RouteStep | null) {
  if (!step) return "繼續前行";
  if (step.type === "arrive") return "即將抵達";
  return step.action || "繼續前行";
}

export const NextIntersectionHud = forwardRef<
  HTMLDivElement,
  {
    step: RouteStep | null;
    followingStep?: RouteStep | null;
    distanceMeters: number;
    offRoute: boolean;
    rerouting?: boolean;
    reroutePending?: boolean;
    junctionFocus?: boolean;
  }
>(function NextIntersectionHud(
  {
    step,
    followingStep = null,
    distanceMeters,
    offRoute,
    rerouting = false,
    reroutePending = false,
    junctionFocus = false,
  },
  ref,
) {
  const turn = shortTurn(step);
  const side = turnSideFromStep(step);
  const following =
    followingStep && followingStep.type !== "arrive"
      ? `接下來 ${formatDistance(followingStep.distanceMeters)} ${followingStep.action}${
          followingStep.roadName ? ` ${followingStep.roadName}` : ""
        }`
      : null;

  return (
    <div
      ref={ref}
      className={cn(
        "navigation-instruction-card pointer-events-none w-full min-w-0 shadow-[0_8px_32px_rgba(0,0,0,0.5)]",
        junctionFocus
          ? "navigation-instruction-card--junction border border-orange-300/45 text-[#fff7ed]"
          : "border border-white/12 bg-black/72 text-white",
      )}
    >
      <div className="navigation-instruction-content">
        <div
          className={cn(
            "navigation-turn-icon flex shrink-0 items-center justify-center rounded-xl",
            junctionFocus
              ? "navigation-turn-icon--signal bg-emerald-500 text-white"
              : "bg-white/12 text-white",
          )}
        >
          <TurnArrowIcon side={side} className="p-1.5" />
        </div>
        <div className="min-w-0 text-left">
          <p className="navigation-guidance truncate tabular-nums tracking-tight">
            {formatDistance(distanceMeters)}
          </p>
          <p
            className={cn(
              "navigation-road-name truncate",
              junctionFocus ? "text-[#ffedd5]" : "text-zinc-200",
            )}
          >
            {turn}
            {step?.roadName ? ` ${step.roadName}` : ""}
          </p>
          {following ? (
            <p
              className={cn(
                "mt-0.5 truncate text-[11px]",
                junctionFocus ? "text-orange-100/90" : "text-zinc-400",
              )}
            >
              {following}
            </p>
          ) : null}
          {rerouting ? (
            <p
              className={cn(
                "mt-0.5 truncate text-[12px] font-medium",
                junctionFocus ? "text-[#ffedd5]" : "text-amber-300",
              )}
            >
              {reroutePending ? "仍在重新規劃路線" : "正在重新規劃路線"}
            </p>
          ) : offRoute ? (
            <p
              className={cn(
                "mt-0.5 truncate text-[12px] font-medium",
                junctionFocus ? "text-[#ffedd5]" : "text-amber-300",
              )}
            >
              偏離路線，即將重算
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
});
