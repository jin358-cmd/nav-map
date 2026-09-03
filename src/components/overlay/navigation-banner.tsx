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

function TurnGlyph({ step }: { step: RouteStep | null }) {
  const type = step?.type ?? "";
  const modifier = step?.modifier ?? "";
  const className = "size-8 text-cyan-200";
  if (type === "arrive") return <Flag className={className} />;
  if (type.includes("roundabout") || type.includes("rotary")) {
    return <RotateCw className={className} />;
  }
  if (modifier.includes("uturn")) return <Undo2 className={className} />;
  if (modifier.includes("left")) return <CornerUpLeft className={className} />;
  if (modifier.includes("right")) return <CornerUpRight className={className} />;
  return <ArrowUp className={className} />;
}

function guidanceLine(step: RouteStep | null) {
  if (!step) return "繼續前行";
  if (step.type === "arrive") {
    return step.roadName ? `抵達${step.roadName}` : "即將抵達";
  }
  if (step.roadName) return `${step.action}進入${step.roadName}`;
  return step.action;
}

export const NextIntersectionHud = forwardRef<
  HTMLDivElement,
  {
    step: RouteStep | null;
    distanceMeters: number;
    offRoute: boolean;
    rerouting?: boolean;
    voiceEnabled: boolean;
    onToggleVoice: () => void;
  }
>(function NextIntersectionHud(
  {
    step,
    distanceMeters,
    offRoute,
    rerouting = false,
    voiceEnabled,
    onToggleVoice,
  },
  ref,
) {
  return (
    <div
      ref={ref}
      className="navigation-instruction-card pointer-events-auto border border-cyan-300/25 bg-black/78 text-white shadow-[0_8px_32px_rgba(0,0,0,0.5)] backdrop-blur-xl"
    >
      <div className="navigation-instruction-content">
        <div className="navigation-turn-icon flex shrink-0 items-center justify-center rounded-2xl bg-cyan-400/15">
          <TurnGlyph step={step} />
        </div>
        <div className="min-w-0 text-left">
          <p className="navigation-next-label tracking-wide text-cyan-200/90">
            下一個路口
          </p>
          <p className="navigation-distance truncate tabular-nums tracking-tight">
            {formatDistance(distanceMeters)}
          </p>
          <p className="navigation-street-name font-medium text-white">
            {guidanceLine(step)}
          </p>
          {rerouting ? (
            <p className="mt-0.5 truncate text-[12px] font-medium text-amber-300">
              正在更新路線…
            </p>
          ) : offRoute ? (
            <p className="mt-0.5 truncate text-[12px] font-medium text-amber-300">
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
            "navigation-audio-button shrink-0 text-zinc-300 hover:bg-white/10 hover:text-white",
          )}
        >
          {voiceEnabled ? (
            <Volume2 className="size-4" />
          ) : (
            <VolumeX className="size-4" />
          )}
        </Button>
      </div>
    </div>
  );
});
