"use client";

import { X } from "lucide-react";
import { projectSignal } from "@/lib/traffic-signals/project.mjs";

export type TrafficSignalView = {
  intersectionId: string;
  signalId: string | null;
  source: string;
  sourceUrl: string | null;
  location: { lng: number; lat: number };
  locationConfidence: "verified" | "reported" | "unknown";
  movement: string;
  headCount?: number;
  equipmentNote?: string | null;
  remainingSeconds: number | null;
  remainingMode: string;
  status: string;
};

export function TrafficSignalCard({
  signal,
  onClose,
}: {
  signal: TrafficSignalView;
  onClose: () => void;
}) {
  const view = projectSignal(signal, { allowDemo: false });
  return (
    <article
      className="pointer-events-auto w-[min(22rem,calc(100vw-1.5rem))] rounded-2xl border border-zinc-400/30 bg-zinc-950/90 p-3 text-white shadow-2xl backdrop-blur-xl"
      aria-label={view.ariaLabel}
    >
      <div className="flex items-start gap-3">
        <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-zinc-700/80 text-lg text-zinc-100">
          🚦 --
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] text-zinc-300">路口號誌</p>
          <h2 className="mt-0.5 text-sm font-semibold">即時秒數未提供</h2>
          <p className="mt-1 text-xs leading-5 text-zinc-300">{view.message}</p>
          <dl className="mt-2 space-y-1 text-[11px] leading-4 text-zinc-400">
            <div>編號：{signal.signalId ?? "尚未確認"}</div>
            <div>方向：尚未確認</div>
            <div>燈態：尚未確認</div>
            <div>秒數：--</div>
            <div>設備註記：{signal.equipmentNote ?? "尚未確認"}</div>
            <div>來源：{signal.source}</div>
          </dl>
          {signal.sourceUrl ? (
            <a
              href={signal.sourceUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-2 inline-flex rounded-lg border border-zinc-400/40 px-2 py-1 text-[11px] text-zinc-100"
            >
              查看圖資來源
            </a>
          ) : null}
          <p className="mt-2 text-[11px] leading-4 text-zinc-500">
            這是歷史位置圖資，不是即時燈號。以現場號誌及員警指揮為準。
          </p>
        </div>
        <button
          type="button"
          aria-label="關閉路口號誌"
          onClick={onClose}
          className="flex size-9 shrink-0 items-center justify-center rounded-lg text-zinc-400 hover:bg-white/10"
        >
          <X className="size-4" />
        </button>
      </div>
    </article>
  );
}
