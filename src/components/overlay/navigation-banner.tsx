"use client";

import { forwardRef } from "react";
import {
  ArrowUp,
  CornerUpLeft,
  CornerUpRight,
  Flag,
  RotateCw,
  Undo2,
  Volume2,
  VolumeX,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatDistance } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { RouteStep } from "@/types/domain";

function TurnGlyph({
  step,
  junction,
}: {
  step: RouteStep | null;
  junction?: boolean;
}) {
  const type = step?.type ?? "";
  const modifier = step?.modifier ?? "";
  const className = junction
    ? "size-12 text-[#fff7ed]"
    : "size-10 text-cyan-200";
  if (type === "arrive") return <Flag className={className} />;
  if (type.includes("roundabout") || type.includes("rotary")) {
    return <RotateCw className={className} />;
  }
  if (modifier.includes("uturn")) return <Undo2 className={className} />;
  if (modifier.includes("left")) return <CornerUpLeft className={className} />;
  if (modifier.includes("right")) return <CornerUpRight className={className} />;
  return <ArrowUp className={className} />;
}

function shortTurn(step: RouteStep | null) {
  if (!step) return "繼續前行";
  if (step.type === "arrive") return "即將抵達";
  return step.action || "繼續前行";
}

function shortGuidance(step: RouteStep | null, distanceMeters: number) {
  const turn = shortTurn(step);
  if (step?.type === "arrive") return turn;
  return `${formatDistance(distanceMeters)}後${turn}`;
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
    voiceEnabled: boolean;
    onToggleVoice: () => void;
  }
>(function NextIntersectionHud(
  {
    step,
    distanceMeters,
    offRoute,
    rerouting = false,
    reroutePending = false,
    junctionFocus = false,
    voiceEnabled,
    onToggleVoice,
  },
  ref,
) {
  return (
    <div
      ref={ref}
      className={cn(
        "navigation-instruction-card pointer-events-auto w-full min-w-0 shadow-[0_8px_32px_rgba(0,0,0,0.5)] backdrop-blur-xl",
        junctionFocus
          ? "navigation-instruction-card--junction border border-orange-300/50 text-[#fff7ed]"
          : "border border-cyan-300/25 bg-black/78 text-white",
      )}
    >
      <div className="navigation-instruction-content">
        <div
          className={cn(
            "navigation-turn-icon flex shrink-0 items-center justify-center rounded-2xl",
            junctionFocus
              ? "navigation-turn-icon--signal bg-black/12"
              : "bg-cyan-400/15",
          )}
        >
          <TurnGlyph step={step} junction={junctionFocus} />
        </div>
        <div className="min-w-0 text-left">
          <p className="navigation-guidance truncate tabular-nums tracking-tight">
            {shortGuidance(step, distanceMeters)}
          </p>
          <p
            className={cn(
              "navigation-road-name truncate",
              junctionFocus ? "text-[#ffedd5]" : "text-zinc-300",
            )}
          >
            {step?.roadName || (step?.type === "arrive" ? "目的地" : "沿目前道路")}
          </p>
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
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label={voiceEnabled ? "關閉 AI 語音" : "開啟 AI 語音"}
          aria-pressed={voiceEnabled}
          onClick={onToggleVoice}
          className={cn(
            "navigation-audio-button shrink-0 hover:bg-white/10",
            junctionFocus
              ? "text-[#fff7ed] hover:text-white"
              : "text-zinc-300 hover:text-white",
          )}
        >
          {voiceEnabled ? (
            <Volume2 className="size-5" />
          ) : (
            <VolumeX className="size-5" />
          )}
        </Button>
      </div>
    </div>
  );
});
