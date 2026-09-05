"use client";

import { useEffect, useRef, useState } from "react";
import {
  readableGpsSpeedKmh,
  smoothSpeedKmh,
  type SpeedSample,
} from "@/lib/speed-estimation";
import {
  isReliableSpeedLimit,
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
  const showLimit = isReliableSpeedLimit(limit);
  const limitValue = showLimit ? limit.speedLimitKph : null;
  const over =
    kmh != null && limitValue != null && kmh > limitValue + 3;

  return (
    <div className="pointer-events-none flex flex-col items-center rounded-lg border border-white/12 bg-black/50 px-1.5 py-1">
      <div className="min-w-[2.35rem] text-center">
        <p
          className={cn(
            "text-[13px] font-black leading-none tabular-nums text-white",
            over && "text-amber-200",
          )}
        >
          {display}
        </p>
        <p className="mt-px text-[7px] leading-none text-zinc-300">km/h</p>
      </div>
      {showLimit && limitValue != null ? (
        <div
          className="mt-1 flex size-7 flex-col items-center justify-center rounded-full border-[2px] border-red-600 bg-white text-zinc-900"
          title={`限速來源 ${limit.source}`}
        >
          <span className="text-[11px] font-black leading-none tabular-nums">
            {limitValue}
          </span>
        </div>
      ) : null}
    </div>
  );
}
