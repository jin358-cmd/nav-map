"use client";

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
  compact,
}: {
  step: RouteStep | null;
  compact?: boolean;
}) {
  const type = step?.type ?? "";
  const modifier = step?.modifier ?? "";
  const className = compact ? "size-7 text-cyan-200" : "size-12 text-cyan-200";
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

export function NextIntersectionHud({
  step,
  distanceMeters,
  offRoute,
  rerouting = false,
  voiceEnabled,
  compact = false,
  onToggleVoice,
}: {
  step: RouteStep | null;
  distanceMeters: number;
  offRoute: boolean;
  rerouting?: boolean;
  voiceEnabled: boolean;
  compact?: boolean;
  onToggleVoice: () => void;
}) {
  return (
    <div
      className={cn(
        "pointer-events-auto flex items-center text-white shadow-[0_8px_32px_rgba(0,0,0,0.5)] backdrop-blur-xl",
        compact
          ? "w-fit max-w-[24rem] origin-top-left scale-[2.5] gap-2 rounded-xl border border-cyan-300/25 bg-black/78 px-2 py-1.5"
          : "w-full max-w-2xl gap-3 rounded-2xl border border-cyan-300/25 bg-black/75 px-3 py-2.5 sm:gap-4 sm:px-5 sm:py-3",
      )}
    >
      <div
        className={cn(
          "flex shrink-0 items-center justify-center bg-cyan-400/15",
          compact ? "size-11 rounded-lg" : "size-20 rounded-2xl",
        )}
      >
        <TurnGlyph step={step} compact={compact} />
      </div>
      <div className={cn("min-w-0 flex-1", compact ? "text-left" : "text-center sm:text-left")}>
        <p
          className={cn(
            "tracking-wide text-cyan-200/90",
            compact ? "text-[11px] leading-tight" : "text-[22px] leading-tight",
          )}
        >
          下一個路口
        </p>
        <p
          className={cn(
            "truncate font-semibold tabular-nums leading-none tracking-tight",
            compact ? "text-[22px]" : "text-[40px] sm:text-[48px]",
          )}
        >
          {formatDistance(distanceMeters)}
        </p>
        <p
          className={cn(
            "truncate font-medium leading-tight text-white",
            compact ? "mt-0.5 text-[12px]" : "mt-1 text-[22px]",
          )}
        >
          {guidanceLine(step)}
        </p>
        {rerouting ? (
          <p
            className={cn(
              "font-medium leading-tight text-amber-300",
              compact ? "text-[11px]" : "text-[22px]",
            )}
          >
            正在更新路線…
          </p>
        ) : offRoute ? (
          <p
            className={cn(
              "font-medium leading-tight text-amber-300",
              compact ? "text-[11px]" : "text-[22px]",
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
          "shrink-0 text-zinc-300 hover:bg-white/10 hover:text-white",
          compact ? "size-8" : "size-10",
        )}
      >
        {voiceEnabled ? (
          <Volume2 className={compact ? "size-4" : "size-5"} />
        ) : (
          <VolumeX className={compact ? "size-4" : "size-5"} />
        )}
      </Button>
    </div>
  );
}
