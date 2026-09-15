"use client";

import { geoErrorMessage } from "@/services/geolocation";
import type { GpsErrorCode } from "@/types/domain";

export function LocateStatusBanner({
  error,
  onRetry,
  onDismiss,
}: {
  error: GpsErrorCode;
  onRetry: () => void;
  onDismiss: () => void;
}) {
  if (!error) return null;
  return (
    <div className="pointer-events-auto absolute top-[max(4.75rem,calc(env(safe-area-inset-top)+3.8rem))] left-1/2 z-[80] w-[min(22rem,calc(100vw-1.5rem))] -translate-x-1/2 rounded-2xl border border-amber-300/40 bg-black/82 px-3 py-2.5 text-amber-50 shadow-lg backdrop-blur-md">
      <p className="text-[13px] font-semibold">無法取得目前位置</p>
      <p className="mt-0.5 text-[12px] leading-snug text-amber-100/90">
        {geoErrorMessage(error)}
      </p>
      <div className="mt-2 flex gap-2">
        <button
          type="button"
          onClick={onRetry}
          className="rounded-full bg-cyan-400 px-3 py-1 text-[12px] font-semibold text-zinc-950 touch-manipulation"
        >
          再試一次
        </button>
        <button
          type="button"
          onClick={onDismiss}
          className="rounded-full border border-white/25 px-3 py-1 text-[12px] text-zinc-100 touch-manipulation"
        >
          關閉
        </button>
      </div>
    </div>
  );
}
