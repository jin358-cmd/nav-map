"use client";

import type { CSSProperties } from "react";
import { cn } from "@/lib/utils";

function readCopy(label: string) {
  const trimmed = label.trim() || "全國生活圖層";
  if (trimmed.endsWith("讀取中")) {
    return {
      name: trimmed.slice(0, -3).trim() || "全國生活圖層",
      status: "讀取中",
    };
  }
  return { name: trimmed, status: "讀取中" };
}

export function PoiLayerReadProgress({
  progress,
  compact = false,
  label = "全國生活圖層",
}: {
  progress: number;
  compact?: boolean;
  label?: string;
}) {
  const pct = Math.max(0, Math.min(100, Math.round(progress)));
  const style = { "--poi-progress": pct } as CSSProperties;
  const { name, status } = readCopy(label);

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
      aria-label={`${name} ${status} ${pct}%`}
      className="poi-layer-read-hud pointer-events-none"
    >
      <span className="poi-layer-read-pie" style={style}>
        <span className="poi-layer-read-pie__hole">{pct}%</span>
      </span>
      <p className="poi-layer-read-hud__label">
        <span className="poi-layer-read-hud__name">{name}</span>
        <span className="poi-layer-read-hud__status">{status}</span>
      </p>
      <span className="poi-layer-read-bar" aria-hidden>
        <span className="poi-layer-read-bar__fill" style={{ width: `${pct}%` }} />
      </span>
    </div>
  );
}

export function PoiLayerReadBanner({
  progress,
  label = "全國生活圖層",
  className,
}: {
  progress: number;
  label?: string;
  className?: string;
}) {
  const pct = Math.max(0, Math.min(100, Math.round(progress)));
  const { name, status } = readCopy(label);
  return (
    <div
      role="status"
      aria-live="polite"
      aria-label={`${name} ${status} ${pct}%`}
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
      <span className="min-w-0 flex-1">
        <span className="poi-layer-read-hud__label poi-layer-read-hud__label--banner">
          <span className="poi-layer-read-hud__name">{name}</span>
          <span className="poi-layer-read-hud__status">{status}</span>
        </span>
        <span className="poi-layer-read-bar mt-1" aria-hidden>
          <span className="poi-layer-read-bar__fill" style={{ width: `${pct}%` }} />
        </span>
      </span>
    </div>
  );
}
