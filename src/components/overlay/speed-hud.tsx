"use client";

import { useEffect, useRef, useState } from "react";
import {
  readableGpsSpeedKmh,
  smoothSpeedKmh,
  type SpeedSample,
} from "@/lib/speed-estimation";

export function SpeedHud({ sample }: { sample: SpeedSample }) {
  const previousSample = useRef<SpeedSample | null>(null);
  const [kmh, setKmh] = useState<number | null>(null);

  useEffect(() => {
    const raw = readableGpsSpeedKmh(sample, previousSample.current);
    previousSample.current = sample;
    setKmh((current) => smoothSpeedKmh(current, raw));
  }, [sample]);

  const display = kmh == null ? "--" : String(Math.round(kmh));

  return (
    <div className="hud-speed-gps pointer-events-none flex w-full flex-col items-start justify-center px-2">
      <p className="hud-speed-gps__value font-black leading-none tabular-nums text-white">
        {display}
      </p>
      <p className="hud-speed-gps__unit leading-none text-zinc-300">km/h</p>
    </div>
  );
}

export function SpeedLimitBadge({
  kph,
}: {
  kph: number | null;
}) {
  return (
    <div className="hud-speed-limit-slot pointer-events-none flex w-full items-center justify-start px-2">
      {kph != null ? (
        <div
          className="hud-speed-limit-badge flex items-center justify-center rounded-full bg-white text-zinc-900"
          title="路段測速限速"
        >
          <span className="font-black leading-none tabular-nums">{kph}</span>
        </div>
      ) : null}
    </div>
  );
}
