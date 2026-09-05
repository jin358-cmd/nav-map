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
    <div className="pointer-events-none flex items-center gap-2 rounded-xl border border-white/12 bg-black/50 px-2 py-1 shadow-lg">
      <div className="min-w-[2.7rem] text-center">
        <p
          className={cn(
            "text-[15px] font-black leading-none tabular-nums text-white",
            over && "text-amber-200",
          )}
        >
          {display}
        </p>
        <p className="mt-0.5 text-[8px] text-zinc-300">km/h</p>
      </div>
      <div
        className="flex size-9 flex-col items-center justify-center rounded-full border-[2px] border-red-600 bg-white text-zinc-900"
        title={
          limit.source === "NOT CONFIGURED"
            ? "道路限速尚未設定"
            : `限速來源 ${limit.source}`
        }
      >
        <span className="text-[13px] font-black leading-none tabular-nums">
          {limitValue ?? "--"}
        </span>
        <span className="text-[7px] font-semibold tracking-wide text-zinc-500">
          速限
        </span>
      </div>
    </div>
  );
}
