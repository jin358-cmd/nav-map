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
    <div className="pointer-events-none flex max-w-[min(18.5rem,calc(100vw-6.5rem))] flex-col gap-2">
      <SpeedHud sample={sample} limit={unresolvedSpeedLimit()} />
      <div className="rounded-2xl border border-violet-200/25 bg-violet-700/50 px-3.5 py-2.5 text-white shadow-lg">
        <div>
          <p className="text-[10px] font-medium leading-none text-zinc-200">
            剩餘時間
          </p>
          <p className="mt-0.5 text-[18px] font-bold leading-tight">
            {minutes != null ? `${minutes} 分鐘` : "--"}
          </p>
        </div>
        <div className="mt-1.5">
          <p className="text-[10px] font-medium leading-none text-zinc-200">
            剩餘距離
          </p>
          <p className="mt-0.5 text-[17px] font-semibold leading-tight tabular-nums text-zinc-100">
            {km}
          </p>
        </div>
        <div className="mt-1.5">
          <p className="text-[10px] font-medium leading-none text-zinc-200">
            預計抵達時間
          </p>
          <p className="mt-0.5 text-[17px] font-semibold leading-tight tabular-nums text-yellow-300">
            {eta}
          </p>
        </div>
      </div>
    </div>
  );
}
