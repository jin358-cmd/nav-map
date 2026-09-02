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
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatDistance } from "@/lib/format";
import type { RouteStep } from "@/types/domain";

function TurnGlyph({ step }: { step: RouteStep | null }) {
  const type = step?.type ?? "";
  const modifier = step?.modifier ?? "";
  const className = "size-12 text-cyan-200";
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
  onToggleVoice,
  onExit,
}: {
  step: RouteStep | null;
  distanceMeters: number;
  offRoute: boolean;
  rerouting?: boolean;
  voiceEnabled: boolean;
  onToggleVoice: () => void;
  onExit: () => void;
}) {
  return (
    <div className="pointer-events-auto flex w-full max-w-2xl items-center gap-3 rounded-2xl border border-cyan-300/25 bg-black/75 px-3 py-2.5 text-white shadow-[0_8px_32px_rgba(0,0,0,0.5)] backdrop-blur-xl sm:gap-4 sm:px-5 sm:py-3">
      <div className="flex size-20 shrink-0 items-center justify-center rounded-2xl bg-cyan-400/15">
        <TurnGlyph step={step} />
      </div>
      <div className="min-w-0 flex-1 text-center sm:text-left">
        <p className="text-[22px] leading-tight tracking-wide text-cyan-200/90">
          下一個路口
        </p>
        <p className="truncate text-[40px] font-semibold tabular-nums leading-none tracking-tight sm:text-[48px]">
          {formatDistance(distanceMeters)}
        </p>
        <p className="mt-1 truncate text-[22px] font-medium leading-tight text-white">
          {guidanceLine(step)}
        </p>
        {rerouting ? (
          <p className="text-[22px] font-medium leading-tight text-amber-300">
            正在更新路線…
          </p>
        ) : offRoute ? (
          <p className="text-[22px] font-medium leading-tight text-amber-300">
            偏離路線，即將重算
          </p>
        ) : null}
      </div>
      <div className="flex shrink-0 flex-col gap-1">
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label={voiceEnabled ? "關閉 AI 語音" : "開啟 AI 語音"}
          aria-pressed={voiceEnabled}
          onClick={onToggleVoice}
          className="size-10 text-zinc-300 hover:bg-white/10 hover:text-white"
        >
          {voiceEnabled ? <Volume2 className="size-5" /> : <VolumeX className="size-5" />}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label="結束導航"
          onClick={onExit}
          className="size-10 text-zinc-300 hover:bg-white/10 hover:text-white"
        >
          <X className="size-5" />
        </Button>
      </div>
    </div>
  );
}
