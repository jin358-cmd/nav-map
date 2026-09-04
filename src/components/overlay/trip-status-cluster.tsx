"use client";

import { SpeedHud } from "@/components/overlay/speed-hud";
import { formatEtaClock } from "@/lib/travel-mode";
import { unresolvedSpeedLimit } from "@/lib/speed-limit";
import type { SpeedSample } from "@/lib/speed-estimation";

export function TripStatusCluster({
  sample,
  remainingMeters,
  remainingSeconds,
}: {
  sample: SpeedSample;
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
        ? `${(remainingMeters / 1000).toFixed(0)} 公里`
        : `${(remainingMeters / 1000).toFixed(1)} 公里`
      : "--";
  const eta =
    remainingSeconds != null ? formatEtaClock(remainingSeconds) : "--";

  return (
    <div className="pointer-events-none flex max-w-[min(16rem,calc(100vw-6.5rem))] flex-col gap-1.5">
      <SpeedHud sample={sample} limit={unresolvedSpeedLimit()} />
      <div className="rounded-2xl border border-white/12 bg-black/72 px-3 py-2 text-white shadow-lg backdrop-blur-md">
        <p className="text-[16px] font-bold leading-tight">
          {minutes != null ? `剩餘 ${minutes} 分鐘` : "剩餘 --"}
        </p>
        <p className="text-[15px] font-semibold tabular-nums text-zinc-100">{km}</p>
        <p className="text-[13px] text-zinc-300">預計 {eta} 抵達</p>
      </div>
    </div>
  );
}
