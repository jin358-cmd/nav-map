"use client";

import {
  ArrowUp,
  CornerUpLeft,
  CornerUpRight,
  Flag,
  RotateCw,
  Undo2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatDistance } from "@/lib/format";
import type { RouteStep } from "@/types/domain";

function TurnGlyph({ step }: { step: RouteStep | null }) {
  const type = step?.type ?? "";
  const modifier = step?.modifier ?? "";
  const className = "size-6 text-cyan-200";
  if (type === "arrive") return <Flag className={className} />;
  if (type.includes("roundabout") || type.includes("rotary")) {
    return <RotateCw className={className} />;
  }
  if (modifier.includes("uturn")) return <Undo2 className={className} />;
  if (modifier.includes("left")) return <CornerUpLeft className={className} />;
  if (modifier.includes("right")) return <CornerUpRight className={className} />;
  return <ArrowUp className={className} />;
}

export function NextIntersectionHud({
  step,
  distanceMeters,
  offRoute,
  rerouting = false,
  onExit,
}: {
  step: RouteStep | null;
  distanceMeters: number;
  offRoute: boolean;
  rerouting?: boolean;
  onExit: () => void;
}) {
  return (
    <div className="pointer-events-auto flex w-full max-w-md items-center gap-3 rounded-2xl border border-cyan-300/25 bg-black/70 px-3 py-2 text-white shadow-[0_8px_32px_rgba(0,0,0,0.5)] backdrop-blur-xl sm:px-4">
      <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-cyan-400/15">
        <TurnGlyph step={step} />
      </div>
      <div className="min-w-0 flex-1 text-center sm:text-left">
        <p className="text-[11px] tracking-wide text-cyan-200/85">下一個路口</p>
        <p className="truncate text-xl font-semibold tabular-nums tracking-tight sm:text-2xl">
          {formatDistance(distanceMeters)}
        </p>
        {rerouting ? (
          <p className="text-[11px] font-medium text-amber-300">正在更新路線…</p>
        ) : offRoute ? (
          <p className="text-[11px] font-medium text-amber-300">偏離路線，即將重算</p>
        ) : null}
      </div>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        aria-label="結束導航"
        onClick={onExit}
        className="size-8 shrink-0 text-zinc-300 hover:bg-white/10 hover:text-white"
      >
        <X className="size-4" />
      </Button>
    </div>
  );
}
