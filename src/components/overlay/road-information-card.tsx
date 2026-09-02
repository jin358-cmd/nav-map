"use client";

import { useMemo, useState } from "react";
import {
  AlertTriangle,
  Camera,
  Construction,
  TrafficCone,
  X,
} from "lucide-react";
import { YOUTUBE_MUSIC_URL } from "@/lib/constants";
import { cctvOriginLabel, formatDistance, trafficOriginLabel } from "@/lib/format";
import { cn } from "@/lib/utils";
import type {
  CctvDataOrigin,
  RoadIntelItem,
  RoadIntelKind,
  TrafficDataOrigin,
} from "@/types/domain";

const KIND_ORDER: RoadIntelKind[] = [
  "congestion",
  "cctv",
  "construction",
  "accident",
  "disaster",
];

const KIND_META: Record<
  RoadIntelKind,
  { label: string; className: string; activeClass: string; icon: typeof Camera }
> = {
  cctv: {
    label: "CCTV",
    className: "text-violet-300 bg-violet-500/15 border-violet-300/20",
    activeClass: "border-violet-300/70 bg-violet-500/30 text-violet-100",
    icon: Camera,
  },
  construction: {
    label: "施工",
    className: "text-amber-300 bg-amber-500/15 border-amber-300/20",
    activeClass: "border-amber-300/70 bg-amber-500/30 text-amber-100",
    icon: Construction,
  },
  congestion: {
    label: "壅塞",
    className: "text-orange-300 bg-orange-500/15 border-orange-300/20",
    activeClass: "border-orange-300/70 bg-orange-500/30 text-orange-100",
    icon: TrafficCone,
  },
  accident: {
    label: "事故",
    className: "text-red-300 bg-red-500/15 border-red-300/20",
    activeClass: "border-red-300/70 bg-red-500/30 text-red-100",
    icon: AlertTriangle,
  },
  disaster: {
    label: "災害",
    className: "text-amber-200 bg-orange-400/15 border-orange-300/20",
    activeClass: "border-orange-200/70 bg-orange-400/30 text-amber-100",
    icon: AlertTriangle,
  },
};

export function RoadInformationCard({
  items,
  origin,
  trafficOrigin,
  emptyHint,
  onSelectCctv,
}: {
  items: RoadIntelItem[];
  origin: CctvDataOrigin;
  trafficOrigin: TrafficDataOrigin;
  emptyHint?: string;
  onSelectCctv?: (cameraId: string) => void;
}) {
  const [openKind, setOpenKind] = useState<RoadIntelKind | null>(null);

  const groups = useMemo(
    () =>
      KIND_ORDER.map((kind) => ({
        kind,
        items: items.filter((item) => item.kind === kind),
      })).filter((group) => group.items.length > 0),
    [items],
  );

  const openGroup = groups.find((group) => group.kind === openKind);
  const openItems = openGroup?.items ?? [];

  return (
    <section className="pointer-events-auto w-full max-w-xl text-white">
      {openGroup && openItems.length ? (
        <div className="mb-2 rounded-2xl border border-white/10 bg-black/60 p-3 shadow-[0_12px_50px_rgba(0,0,0,0.45)] backdrop-blur-xl sm:rounded-3xl sm:p-4">
          <div className="mb-2 flex items-center justify-between gap-3">
            <h2 className="text-sm font-medium tracking-wide text-zinc-200">
              {KIND_META[openGroup.kind].label}
            </h2>
            <p className="truncate text-[11px] text-zinc-500">
              CCTV {cctvOriginLabel(origin)} · 路況 {trafficOriginLabel(trafficOrigin)}
            </p>
            <button
              type="button"
              aria-label="收合情報"
              onClick={() => setOpenKind(null)}
              className="flex size-8 shrink-0 items-center justify-center rounded-lg text-zinc-400 hover:bg-white/10 hover:text-white touch-manipulation"
            >
              <X className="size-4" />
            </button>
          </div>
          <ul className="max-h-44 space-y-1.5 overflow-y-auto sm:max-h-52 sm:space-y-2">
            {openItems.map((item) => {
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
        </div>
      ) : null}

      <div className="flex items-center justify-center gap-2 rounded-full border border-white/10 bg-black/55 px-2 py-1.5 shadow-[0_10px_32px_rgba(0,0,0,0.4)] backdrop-blur-xl">
        {groups.length === 0 ? (
          <p className="px-2 py-1 text-[11px] text-zinc-500">
            {emptyHint ?? "前方暫無通報"}
          </p>
        ) : (
          groups.map((group) => {
            const meta = KIND_META[group.kind];
            const Icon = meta.icon;
            const active = openKind === group.kind;
            return (
              <button
                key={group.kind}
                type="button"
                aria-label={`${meta.label}${group.items.length}則`}
                aria-pressed={active}
                onClick={() =>
                  setOpenKind((current) =>
                    current === group.kind ? null : group.kind,
                  )
                }
                className={cn(
                  "relative flex size-11 items-center justify-center rounded-full border touch-manipulation",
                  active ? meta.activeClass : meta.className,
                )}
              >
                <Icon className="size-5" />
                <span className="absolute -top-0.5 -right-0.5 flex min-w-4 items-center justify-center rounded-full bg-black/80 px-1 text-[10px] leading-4 text-zinc-200">
                  {group.items.length}
                </span>
              </button>
            );
          })
        )}
        <YouTubeMusicLink />
      </div>
    </section>
  );
}

function YouTubeMusicLink() {
  return (
    <a
      href={YOUTUBE_MUSIC_URL}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="開啟 YouTube Music"
      title="YouTube Music"
      className="relative flex size-11 items-center justify-center rounded-full border border-red-400/35 bg-[#ff0033]/20 touch-manipulation hover:bg-[#ff0033]/35"
    >
      <YouTubeMusicMark />
    </a>
  );
}

function YouTubeMusicMark() {
  return (
    <svg viewBox="0 0 24 24" className="size-6" aria-hidden>
      <circle cx="12" cy="12" r="10" fill="#FF0033" />
      <path d="M10 8.2v7.6L17 12 10 8.2z" fill="#fff" />
    </svg>
  );
}
