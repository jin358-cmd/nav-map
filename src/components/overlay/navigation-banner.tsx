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
    <div
      ref={ref}
      className="navigation-instruction-card pointer-events-none w-full min-w-0"
    >
      <div className="navigation-instruction-content">
        <div
          className={cn(
            "navigation-turn-icon flex shrink-0 items-center justify-center rounded-xl",
            junctionFocus
              ? "navigation-turn-icon--pulse bg-emerald-500 text-white"
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
          {onCancelNavigation || onToggleVoice ? (
            <div className="mt-1.5 flex items-center gap-1.5">
              {onToggleVoice ? (
                <button
                  type="button"
                  onClick={onToggleVoice}
                  aria-pressed={voiceEnabled}
                  aria-label={voiceEnabled ? "關閉導航語音" : "開啟導航語音"}
                  className="pointer-events-auto flex size-8 items-center justify-center rounded-full border border-white/20 bg-zinc-800/90 text-white touch-manipulation"
                >
                  {voiceEnabled ? (
                    <Volume2 className="size-3.5" />
                  ) : (
                    <VolumeX className="size-3.5" />
                  )}
                </button>
              ) : null}
              {onCancelNavigation ? (
                <button
                  type="button"
                  onClick={onCancelNavigation}
                  className="pointer-events-auto h-8 rounded-full border border-rose-300/50 bg-rose-600 px-2.5 text-[12px] font-semibold text-white touch-manipulation"
                >
                  取消
                </button>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
});
