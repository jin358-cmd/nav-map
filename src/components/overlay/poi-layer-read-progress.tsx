"use client";

import type { CSSProperties } from "react";
import { cn } from "@/lib/utils";

export function PoiLayerReadProgress({
  progress,
  compact = false,
}: {
  progress: number;
  compact?: boolean;
}) {
  const pct = Math.max(0, Math.min(100, Math.round(progress)));
  const style = { "--poi-progress": pct } as CSSProperties;

  if (compact) {
    return (
      <span
        className="poi-layer-read-pie poi-layer-read-pie--compact"
        style={style}
        aria-hidden
      />
    );
  }

  return (
    <div
      role="status"
      aria-live="polite"
      aria-label={`生活圖層讀取中 ${pct}%`}
      className="poi-layer-read-hud pointer-events-none"
    >
      <span className="poi-layer-read-pie" style={style}>
        <span className="poi-layer-read-pie__hole">{pct}%</span>
      </span>
      <p className="poi-layer-read-hud__label">生活圖層讀取中</p>
    </div>
  );
}

export function PoiLayerReadBanner({
  progress,
  className,
}: {
  progress: number;
  className?: string;
}) {
  const pct = Math.max(0, Math.min(100, Math.round(progress)));
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "mb-1.5 flex items-center gap-2 rounded-xl bg-white/8 px-1.5 py-1.5",
        className,
      )}
    >
      <span
        className="poi-layer-read-pie poi-layer-read-pie--banner"
        style={{ "--poi-progress": pct } as CSSProperties}
        aria-hidden
      />
      <span className="min-w-0 text-[11px] font-semibold leading-tight text-cyan-100">
        生活圖層讀取中
      </span>
    </div>
  );
}
