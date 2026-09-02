"use client";

import {
  AlertTriangle,
  Camera,
  Construction,
  TrafficCone,
} from "lucide-react";
import { cctvOriginLabel, formatDistance } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { CctvDataOrigin, RoadIntelItem, RoadIntelKind } from "@/types/domain";

const KIND_META: Record<
  RoadIntelKind,
  { label: string; className: string; icon: typeof Camera }
> = {
  cctv: {
    label: "CCTV",
    className: "text-violet-300 bg-violet-500/15",
    icon: Camera,
  },
  construction: {
    label: "施工",
    className: "text-amber-300 bg-amber-500/15",
    icon: Construction,
  },
  congestion: {
    label: "壅塞",
    className: "text-orange-300 bg-orange-500/15",
    icon: TrafficCone,
  },
  accident: {
    label: "事故",
    className: "text-red-300 bg-red-500/15",
    icon: AlertTriangle,
  },
  disaster: {
    label: "災害",
    className: "text-amber-200 bg-orange-400/15",
    icon: AlertTriangle,
  },
};

export function RoadInformationCard({
  items,
  origin,
  emptyHint,
  onSelectCctv,
}: {
  items: RoadIntelItem[];
  origin: CctvDataOrigin;
  emptyHint?: string;
  onSelectCctv?: (cameraId: string) => void;
}) {
  return (
    <section className="pointer-events-auto w-full max-w-xl rounded-2xl border border-white/10 bg-black/55 p-3 text-white shadow-[0_12px_50px_rgba(0,0,0,0.45)] backdrop-blur-xl sm:rounded-3xl sm:p-4">
      <div className="mb-2 flex items-baseline justify-between sm:mb-3">
        <h2 className="text-sm font-medium tracking-wide text-zinc-200">
          前方道路情報
        </h2>
        <p className="text-[11px] text-zinc-500">{cctvOriginLabel(origin)}</p>
      </div>
      {items.length === 0 ? (
        <p className="text-sm text-zinc-400">
          {emptyHint ?? "前方暫無通報。"}
        </p>
      ) : (
        <ul className="space-y-1.5 sm:space-y-2">
          {items.map((item) => {
            const meta = KIND_META[item.kind];
            const Icon = meta.icon;
            const clickable = item.kind === "cctv" && item.cameraId;
            return (
              <li key={item.id}>
                <button
                  type="button"
                  disabled={!clickable}
                  onClick={() => {
                    if (item.cameraId) onSelectCctv?.(item.cameraId);
                  }}
                  className={cn(
                    "flex min-h-11 w-full items-center gap-2.5 rounded-xl bg-white/4 px-2.5 py-1.5 text-left sm:gap-3 sm:rounded-2xl sm:px-3 sm:py-2",
                    clickable && "hover:bg-white/8 touch-manipulation",
                    !clickable && "cursor-default",
                  )}
                >
                  <span
                    className={cn(
                      "flex size-8 shrink-0 items-center justify-center rounded-lg sm:size-9 sm:rounded-xl",
                      meta.className,
                    )}
                  >
                    <Icon className="size-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{item.title}</p>
                    <p className="truncate text-xs text-zinc-400">{item.detail}</p>
                  </div>
                  <span className="shrink-0 text-xs text-zinc-400">
                    {formatDistance(item.distanceMeters)}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
