"use client";

import { Button } from "@/components/ui/button";

export function ParkingArrivalCard({
  minimized = false,
  onFind,
  onSkip,
  onExpand,
}: {
  minimized?: boolean;
  onFind: () => void;
  onSkip: () => void;
  onExpand?: () => void;
}) {
  if (minimized) {
    return (
      <button
        type="button"
        onClick={onExpand}
        className="pointer-events-auto rounded-full border border-emerald-300/35 bg-black/50 px-3 py-1.5 text-[12px] font-semibold text-emerald-100 shadow-lg backdrop-blur-md touch-manipulation"
      >
        停車協助
      </button>
    );
  }

  return (
    <article className="pointer-events-auto hud-float-panel w-full max-w-xl rounded-2xl px-3 py-2.5 text-white">
      <p className="text-sm font-semibold text-emerald-100">即將抵達目的地</p>
      <p className="mt-0.5 text-[13px] text-zinc-200">是否需要尋找附近停車場？</p>
      <div className="mt-2.5 flex gap-2">
        <Button
          type="button"
          onClick={onFind}
          className="h-11 flex-1 rounded-xl bg-emerald-400 text-[#041016] hover:bg-emerald-300"
        >
          找附近停車場
        </Button>
        <Button
          type="button"
          variant="ghost"
          onClick={onSkip}
          className="h-11 px-4 text-zinc-200 hover:bg-white/10 hover:text-white"
        >
          略過
        </Button>
      </div>
    </article>
  );
}
