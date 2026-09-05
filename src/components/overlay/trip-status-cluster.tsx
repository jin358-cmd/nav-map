"use client";

import { formatEtaClock } from "@/lib/travel-mode";

export function TripStatusCluster({
  remainingMeters,
  remainingSeconds,
}: {
  remainingMeters: number | null;
  remainingSeconds: number | null;
}) {
  const minutes =
    remainingSeconds != null
      ? Math.max(1, Math.round(remainingSeconds / 60))
      : null;
  const km =
    remainingMeters != null
      ? remainingMeters >= 10000
        ? (remainingMeters / 1000).toFixed(0)
        : (remainingMeters / 1000).toFixed(1)
      : "--";
  const eta =
    remainingSeconds != null ? formatEtaClock(remainingSeconds) : "--";

  return (
    <div className="hud-trip-card pointer-events-none grid grid-cols-3 divide-x divide-white/15 rounded-2xl border border-violet-200/20 bg-violet-700/50 px-1 py-2 text-white shadow-lg">
      <div className="min-w-0 px-2">
        <p className="text-[10px] font-medium leading-none text-zinc-200">剩餘時間</p>
        <p className="mt-0.5 truncate text-[18px] font-extrabold leading-tight text-yellow-300">
          {minutes != null ? `${minutes}` : "--"}
          <span className="ml-0.5 text-[11px] font-semibold">分鐘</span>
        </p>
      </div>
      <div className="min-w-0 px-2">
        <p className="text-[10px] font-medium leading-none text-zinc-200">剩餘距離</p>
        <p className="mt-0.5 truncate text-[17px] font-semibold leading-tight tabular-nums text-white">
          {km}
          <span className="ml-0.5 text-[11px] font-medium">km</span>
        </p>
      </div>
      <div className="min-w-0 px-2">
        <p className="text-[10px] font-medium leading-none text-zinc-200">預計抵達</p>
        <p className="mt-0.5 truncate text-[17px] font-semibold leading-tight tabular-nums text-white">
          {eta}
        </p>
      </div>
    </div>
  );
}
