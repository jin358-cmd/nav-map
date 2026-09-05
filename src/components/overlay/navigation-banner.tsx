"use client";

import { forwardRef } from "react";
import { Volume2, VolumeX, X } from "lucide-react";
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
  if (cleaned.length <= 22) return cleaned;
  const road = cleaned.match(
    /[\u4e00-\u9fff0-9]+(?:路|街|道|巷|段|線|橋|大道)[^\s]{0,8}/,
  );
  return road?.[0] ?? cleaned.slice(0, 22);
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
      {onCancelNavigation ? (
        <button
          type="button"
          onClick={onCancelNavigation}
          aria-label="取消導航"
          title="取消導航"
          className="navigation-card-cancel pointer-events-auto touch-manipulation"
        >
          <X className="size-3.5" strokeWidth={2.3} />
        </button>
      ) : null}
      <div className="navigation-instruction-content">
        <div
          className={cn(
            "navigation-turn-icon flex shrink-0 items-center justify-center rounded-xl",
            junctionFocus
              ? "navigation-turn-icon--pulse bg-white text-[#2563A8]"
              : "bg-white/16 text-white",
          )}
        >
          <TurnArrowIcon side={side} className="p-0.5" />
        </div>
        <div className="navigation-copy min-w-0 text-left">
          <p className="navigation-guidance truncate tabular-nums tracking-tight">
            {headline}
          </p>
          {road ? <p className="navigation-road-name truncate">{road}</p> : null}
          {rerouting ? (
            <p className="mt-0.5 truncate text-[12px] font-medium text-amber-200">
              {reroutePending ? "仍在重新規劃路線" : "正在重新規劃路線"}
            </p>
          ) : offRoute ? (
            <p className="mt-0.5 truncate text-[12px] font-medium text-amber-200">
              偏離路線，即將重算
            </p>
          ) : null}
        </div>
      </div>
      {onToggleVoice ? (
        <button
          type="button"
          onClick={onToggleVoice}
          aria-pressed={voiceEnabled}
          aria-label={voiceEnabled ? "關閉導航語音" : "開啟導航語音"}
          title={voiceEnabled ? "關閉語音" : "開啟語音"}
          className="navigation-card-voice pointer-events-auto touch-manipulation"
        >
          {voiceEnabled ? (
            <Volume2 className="size-3.5" strokeWidth={2.1} />
          ) : (
            <VolumeX className="size-3.5" strokeWidth={2.1} />
          )}
        </button>
      ) : null}
    </div>
  );
});
