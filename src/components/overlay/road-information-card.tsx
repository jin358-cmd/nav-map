"use client";

import { useMemo, useState } from "react";
import {
  AlertTriangle,
  Camera,
  Construction,
  TrafficCone,
  X,
} from "lucide-react";
import {
  cctvOriginLabel,
  disasterOriginLabel,
  formatDistance,
  trafficOriginLabel,
} from "@/lib/format";
import { cn } from "@/lib/utils";
import type {
  CctvDataOrigin,
  DisasterDataOrigin,
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
  disasterOrigin,
  emptyHint,
  onSelectCctv,
  musicOpen = false,
  onToggleMusic,
  onPreviewOpen,
}: {
  items: RoadIntelItem[];
  origin: CctvDataOrigin;
  trafficOrigin: TrafficDataOrigin;
  disasterOrigin: DisasterDataOrigin;
  emptyHint?: string;
  onSelectCctv?: (cameraId: string) => void;
  musicOpen?: boolean;
  onToggleMusic?: () => void;
  onPreviewOpen?: () => void;
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

  const previewItem = openItems[0] ?? null;

  return (
    <section className="pointer-events-auto inline-flex flex-col items-center text-white">
      {previewItem ? (
        <div className="mb-2 w-fit max-w-[17.5rem] rounded-2xl border border-white/10 bg-black/70 px-2.5 py-2 shadow-[0_12px_40px_rgba(0,0,0,0.45)] backdrop-blur-xl">
          <div className="mb-1 flex items-center justify-between gap-2">
            <p className="text-[11px] tracking-wide text-zinc-400">
              {KIND_META[previewItem.kind].label}
            </p>
            <button
              type="button"
              aria-label="收合情報"
              onClick={() => setOpenKind(null)}
              className="flex size-7 shrink-0 items-center justify-center rounded-lg text-zinc-400 hover:bg-white/10 hover:text-white touch-manipulation"
            >
              <X className="size-3.5" />
            </button>
          </div>
          {(() => {
            const meta = KIND_META[previewItem.kind];
            const Icon = meta.icon;
            const clickable = previewItem.kind === "cctv" && previewItem.cameraId;
            return (
              <button
                type="button"
                disabled={!clickable}
                onClick={() => {
                  if (previewItem.cameraId) onSelectCctv?.(previewItem.cameraId);
                }}
                className={cn(
                  "flex w-full items-center gap-2 text-left",
                  clickable && "touch-manipulation",
                  !clickable && "cursor-default",
                )}
              >
                <span
                  className={cn(
                    "flex size-8 shrink-0 items-center justify-center rounded-lg",
                    meta.className,
                  )}
                >
                  <Icon className="size-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{previewItem.title}</p>
                  <p className="truncate text-[11px] text-zinc-400">
                    {previewItem.detail}
                  </p>
                </div>
                <span className="shrink-0 text-[11px] text-zinc-400">
                  {formatDistance(previewItem.distanceMeters)}
                </span>
              </button>
            );
          })()}
          <p className="mt-1 truncate text-[10px] text-zinc-600">
            CCTV {cctvOriginLabel(origin)} · 路況 {trafficOriginLabel(trafficOrigin)} · 災害 {disasterOriginLabel(disasterOrigin)}
          </p>
        </div>
      ) : null}

      <div className="inline-flex w-fit items-center justify-center gap-1.5 rounded-full border border-white/10 bg-black/55 px-1.5 py-1 shadow-[0_10px_32px_rgba(0,0,0,0.4)] backdrop-blur-xl">
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
                  setOpenKind((current) => {
                    const next = current === group.kind ? null : group.kind;
                    if (next) onPreviewOpen?.();
                    return next;
                  })
                }
                className={cn(
                  "relative flex size-10 items-center justify-center rounded-full border touch-manipulation",
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
        <YouTubeMusicButton
          pressed={musicOpen}
          onToggle={() => {
            setOpenKind(null);
            onToggleMusic?.();
          }}
        />
      </div>
    </section>
  );
}

function YouTubeMusicButton({
  pressed,
  onToggle,
}: {
  pressed: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={pressed ? "關閉 YouTube Music 播放器" : "開啟 YouTube Music 播放器"}
      aria-pressed={pressed}
      title="YouTube Music"
      onClick={onToggle}
      className={cn(
        "relative flex size-10 items-center justify-center rounded-full border touch-manipulation",
        pressed
          ? "border-red-300/70 bg-[#ff0033]/40"
          : "border-red-400/35 bg-[#ff0033]/20 hover:bg-[#ff0033]/35",
      )}
    >
      <YouTubeMusicMark />
    </button>
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
