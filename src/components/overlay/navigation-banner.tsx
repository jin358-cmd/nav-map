"use client";

import { forwardRef } from "react";
import { Volume2, VolumeX } from "lucide-react";
import { TurnArrowIcon, turnSideFromStep } from "@/components/overlay/turn-arrow-icon";
import { formatDistance } from "@/lib/format";
import { formatTaiwanDisplayAddress } from "@/lib/geocoding/format-taiwan-display-address";
import { cn } from "@/lib/utils";
import type { RouteStep } from "@/types/domain";

function shortTurn(step: RouteStep | null) {
  if (!step) return "繼續前行";
  if (step.type === "arrive") return "抵達";
  return step.action || "繼續前行";
}

function shortRoadName(step: RouteStep | null) {
  const raw = step?.roadName?.trim() ?? "";
  if (!raw) return step?.type === "arrive" ? "目的地" : "";
  const cleaned = formatTaiwanDisplayAddress(raw);
  if (cleaned.length <= 18) return cleaned;
  const road = cleaned.match(
    /[\u4e00-\u9fff0-9]+(?:路|街|道|巷|段|線|橋|大道)[^\s]{0,8}/,
  );
  return road?.[0] ?? cleaned.slice(0, 18);
}

export const NextIntersectionHud = forwardRef<
  HTMLDivElement,
  {
    step: RouteStep | null;
    distanceMeters: number;
    offRoute: boolean;
    rerouting?: boolean;
    reroutePending?: boolean;
    junctionFocus?: boolean;
    onCancelNavigation?: () => void;
    voiceEnabled?: boolean;
    onToggleVoice?: () => void;
  }
>(function NextIntersectionHud(
  {
    step,
    distanceMeters,
    offRoute,
    rerouting = false,
    reroutePending = false,
    junctionFocus = false,
    onCancelNavigation,
    voiceEnabled = true,
    onToggleVoice,
  },
  ref,
) {
  const turn = shortTurn(step);
  const side = turnSideFromStep(step);
  const road = shortRoadName(step);
  const headline = `${formatDistance(distanceMeters)}後${turn}`;

  return (
    <div className="flex w-full min-w-0 flex-col items-stretch gap-1.5">
      {onCancelNavigation ? (
        <button
          type="button"
          onClick={onCancelNavigation}
          className="pointer-events-auto h-8 w-fit rounded-full border border-rose-300/50 bg-rose-600 px-3 text-[12px] font-semibold text-white shadow-md touch-manipulation"
        >
          取消導航
        </button>
      ) : null}
      {onToggleVoice ? (
        <button
          type="button"
          onClick={onToggleVoice}
          aria-pressed={voiceEnabled}
          className="pointer-events-auto flex h-8 w-fit items-center gap-1.5 rounded-full border border-white/20 bg-zinc-800/88 px-3 text-[12px] font-semibold text-white shadow-md touch-manipulation"
        >
          {voiceEnabled ? (
            <Volume2 className="size-3.5" />
          ) : (
            <VolumeX className="size-3.5" />
          )}
          聲音 {voiceEnabled ? "ON" : "OFF"}
        </button>
      ) : null}
      <div
        ref={ref}
        className="navigation-instruction-card pointer-events-none w-full min-w-0"
      >
        <div className="navigation-instruction-content">
          <div
            className={cn(
              "navigation-turn-icon flex shrink-0 items-center justify-center rounded-xl",
              junctionFocus
                ? "navigation-turn-icon--signal bg-emerald-500 text-white"
                : "bg-white/14 text-white",
            )}
          >
            <TurnArrowIcon side={side} className="p-1.5" />
          </div>
          <div className="min-w-0 text-left">
            <p className="navigation-guidance truncate tabular-nums tracking-tight">
              {headline}
            </p>
            {road ? <p className="navigation-road-name truncate">{road}</p> : null}
            {rerouting ? (
              <p className="mt-0.5 truncate text-[12px] font-medium text-amber-300">
                {reroutePending ? "仍在重新規劃路線" : "正在重新規劃路線"}
              </p>
            ) : offRoute ? (
              <p className="mt-0.5 truncate text-[12px] font-medium text-amber-300">
                偏離路線，即將重算
              </p>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
});
