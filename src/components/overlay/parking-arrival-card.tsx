"use client";

import { Button } from "@/components/ui/button";

export function ParkingArrivalCard({
  onFind,
  onSkip,
}: {
  onFind: () => void;
  onSkip: () => void;
}) {
  return (
    <article className="pointer-events-auto w-full max-w-xl rounded-2xl border border-emerald-300/25 bg-black/80 px-3 py-2.5 text-white shadow-[0_12px_40px_rgba(0,0,0,0.5)] backdrop-blur-xl">
      <p className="text-sm font-semibold text-emerald-100">即將抵達目的地</p>
      <p className="mt-0.5 text-[13px] text-zinc-300">是否搜尋目的地附近停車場？</p>
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
          className="h-11 px-4 text-zinc-300 hover:bg-white/10 hover:text-white"
        >
          略過
        </Button>
      </div>
    </article>
  );
}
