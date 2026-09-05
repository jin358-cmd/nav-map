"use client";

import { useEffect, useRef, useState } from "react";
import {
  readableGpsSpeedKmh,
  smoothSpeedKmh,
  type SpeedSample,
} from "@/lib/speed-estimation";
import {
  unresolvedSpeedLimit,
  type SpeedLimitReading,
} from "@/lib/speed-limit";
import { cn } from "@/lib/utils";

export function SpeedHud({
  sample,
  limit = unresolvedSpeedLimit(),
}: {
  sample: SpeedSample;
  limit?: SpeedLimitReading;
}) {
  const previousSample = useRef<SpeedSample | null>(null);
  const [kmh, setKmh] = useState<number | null>(null);

  useEffect(() => {
    const raw = readableGpsSpeedKmh(sample, previousSample.current);
    previousSample.current = sample;
    setKmh((current) => smoothSpeedKmh(current, raw));
  }, [sample]);

  const display = kmh == null ? "--" : String(Math.round(kmh));
  const limitValue = limit.speedLimitKph;
  const over =
    kmh != null && limitValue != null && kmh > limitValue + 3;

  return (
    <div className="pointer-events-none flex items-end gap-2">
      <div className="min-w-[4.5rem] rounded-2xl border border-white/12 bg-black/50 px-2.5 py-1.5 shadow-lg">
        <p className={cn("text-[22px] font-black tabular-nums leading-none text-white", over && "text-amber-200")}>
          {display}
        </p>
        <p className="mt-0.5 text-[11px] text-zinc-300">km/h · GPS</p>
      </div>
      <div
        className="flex size-14 flex-col items-center justify-center rounded-full border-[3px] border-red-600 bg-white text-zinc-900 shadow-[0_2px_8px_rgba(0,0,0,0.35)]"
        title={
          limit.source === "NOT CONFIGURED"
            ? "道路限速尚未設定"
            : `限速來源 ${limit.source}`
        }
      >
        <span className="text-[20px] font-black leading-none tabular-nums">
          {limitValue ?? "--"}
        </span>
        <span className="text-[9px] font-semibold tracking-wide text-zinc-500">
          限速
        </span>
      </div>
    </div>
  );
}
