"use client";

import { useMemo, useState } from "react";
import { Heart } from "lucide-react";
import {
  AccidentTriangleIcon,
  CctvLensIcon,
  CongestionCarsIcon,
  ConstructionBarrierIcon,
  DisasterWarningIcon,
} from "@/components/overlay/status-icons";
import { AccountChip } from "@/components/overlay/account-chip";
import { cctvOriginLabel, disasterOriginLabel } from "@/lib/format";
import type { GoogleAccount } from "@/lib/google-identity";
import { cn } from "@/lib/utils";
import type {
  CctvDataOrigin,
  DisasterDataOrigin,
  GeocodeHit,
  LayerKindVisibility,
  RoadIntelItem,
  RoadIntelKind,
} from "@/types/domain";
import type { RouteAlert } from "@/lib/route-events";

const TOP_KIND_ORDER: RoadIntelKind[] = ["cctv"];
const BOTTOM_KIND_ORDER: RoadIntelKind[] = [
  "accident",
  "construction",
  "disaster",
];

const KIND_META: Record<
  RoadIntelKind,
  { label: string; className: string; activeClass: string; icon: typeof CongestionCarsIcon }
> = {
  cctv: {
    label: "CCTV",
    className: "text-violet-300 bg-violet-500/15 border-violet-300/20",
    activeClass: "border-violet-300/70 bg-violet-500/30 text-violet-100",
    icon: CctvLensIcon,
  },
  construction: {
    label: "施工",
    className: "text-amber-300 bg-amber-500/15 border-amber-300/20",
    activeClass: "border-amber-300/70 bg-amber-500/30 text-amber-100",
    icon: ConstructionBarrierIcon,
  },
  congestion: {
    label: "壅塞",
    className: "text-orange-300 bg-orange-500/15 border-orange-300/20",
    activeClass: "border-orange-300/70 bg-orange-500/30 text-orange-100",
    icon: CongestionCarsIcon,
  },
  accident: {
    label: "事故",
    className: "text-red-300 bg-red-500/15 border-red-300/20",
    activeClass: "border-red-300/70 bg-red-500/30 text-red-100",
    icon: AccidentTriangleIcon,
  },
  disaster: {
    label: "災害",
    className: "text-amber-200 bg-orange-400/15 border-orange-300/20",
    activeClass: "border-orange-200/70 bg-orange-400/30 text-amber-100",
    icon: DisasterWarningIcon,
  },
};

export function RoadInformationCard({
  items,
  origin,
  disasterOrigin,
  onSelectCctv,
  layerVisibility,
  activeKind = null,
  onKindClick,
  musicOpen = false,
  onToggleMusic,
  onPreviewOpen,
  favorites = [],
  favoritesOpen = false,
  isCurrentFavorite = false,
  routeAlert = null,
  compact = true,
  onHeartClick,
  account = null,
  accountBusy = false,
  accountHint = null,
  accountConfigured = false,
  accountUnavailable = false,
  onSignIn,
  onSignOut,
  parkingOn = false,
  parkingLoading = false,
  onToggleParking,
}: {
  items: RoadIntelItem[];
  origin: CctvDataOrigin;
  disasterOrigin: DisasterDataOrigin;
  emptyHint?: string;
  onSelectCctv?: (cameraId: string) => void;
  layerVisibility?: LayerKindVisibility;
  activeKind?: RoadIntelKind | null;
  onKindClick?: (kind: RoadIntelKind) => void;
  musicOpen?: boolean;
  onToggleMusic?: () => void;
  onPreviewOpen?: () => void;
  favorites?: GeocodeHit[];
  favoritesOpen?: boolean;
  isCurrentFavorite?: boolean;
  onHeartClick?: () => void;
  routeAlert?: RouteAlert | null;
  compact?: boolean;
  account?: GoogleAccount | null;
  accountBusy?: boolean;
  accountHint?: string | null;
  accountConfigured?: boolean;
  accountUnavailable?: boolean;
  onSignIn?: () => void;
  onSignOut?: () => void;
  parkingOn?: boolean;
  parkingLoading?: boolean;
  onToggleParking?: () => void;
}) {
  const [openKind, setOpenKind] = useState<RoadIntelKind | null>(null);
  const selectedKind = activeKind ?? openKind;

  const counts = useMemo(() => {
    const next: Record<RoadIntelKind, number> = {
      congestion: 0,
      cctv: 0,
      construction: 0,
      accident: 0,
      disaster: 0,
    };
    for (const item of items) next[item.kind] += 1;
    return next;
  }, [items]);

  const handleKind = (kind: RoadIntelKind) => {
    onPreviewOpen?.();
    if (onKindClick) {
      onKindClick(kind);
      return;
    }
    setOpenKind((current) => {
      const next = current === kind ? null : kind;
      if (next && kind === "cctv") {
        const camera = items.find((item) => item.kind === "cctv" && item.cameraId);
        if (camera?.cameraId) onSelectCctv?.(camera.cameraId);
      }
      return next;
    });
  };

  return (
    <section className="function-menu pointer-events-auto relative inline-flex flex-col items-end text-white">
      <div className="function-menu__title mb-1.5 flex w-full items-center justify-end gap-2 px-0.5">
        <p className="text-[11px] tracking-wide text-zinc-300">功能選單</p>
      </div>

      {routeAlert ? (
        <div className="mb-1.5 w-[min(22rem,calc(100vw-1.25rem))] rounded-2xl border border-amber-300/30 bg-zinc-900/90 px-3 py-2 text-left shadow-[0_10px_28px_rgba(0,0,0,0.45)]">
          <p className="truncate text-sm font-semibold text-amber-100">
            {routeAlert.emoji} {routeAlert.headline}
          </p>
          <p className="truncate text-[11px] text-zinc-400">{routeAlert.detail}</p>
        </div>
      ) : null}

      <div className="inline-flex flex-col items-end gap-1.5 rounded-2xl border border-zinc-500/40 bg-zinc-900/50 px-1.5 py-1.5 shadow-[0_10px_32px_rgba(0,0,0,0.4)] backdrop-blur-xl">
        <div className="flex flex-row-reverse items-end justify-end gap-1.5">
          <YouTubeMusicButton
            pressed={musicOpen}
            onToggle={() => {
              setOpenKind(null);
              onToggleMusic?.();
            }}
          />
          <FavoriteHeartButton
            pressed={favoritesOpen || isCurrentFavorite}
            count={favorites.length}
            onToggle={() => {
              setOpenKind(null);
              onHeartClick?.();
            }}
          />
          {TOP_KIND_ORDER.map((kind) => (
            <KindChip
              key={kind}
              kind={kind}
              count={counts[kind]}
              layerOn={layerVisibility ? layerVisibility[kind] : true}
              selected={selectedKind === kind}
              onClick={() => handleKind(kind)}
            />
          ))}
          <AccountChip
            compact
            account={account}
            busy={accountBusy}
            hint={accountHint}
            configured={accountConfigured}
            unavailable={accountUnavailable}
            onSignIn={() => onSignIn?.()}
            onSignOut={() => onSignOut?.()}
          />
        </div>
        <div className="flex flex-row-reverse items-end justify-end gap-1.5">
          <button
            type="button"
            title="停車"
            aria-label={parkingLoading ? "停車，正在搜尋附近停車場" : "停車"}
            aria-pressed={parkingOn}
            aria-busy={parkingLoading}
            onClick={() => {
              onPreviewOpen?.();
              onToggleParking?.();
            }}
            className={cn(
              "function-chip relative flex items-center justify-center border touch-manipulation",
              parkingOn
                ? "border-sky-300/80 bg-sky-500/35 text-sky-100"
                : "border-sky-400/40 bg-sky-500/15 text-sky-200",
              !parkingOn && "opacity-80",
            )}
          >
            {parkingLoading ? (
              <span
                className="parking-chip-spinner"
                aria-hidden
              />
            ) : null}
            <span className="parking-p-mark function-chip__icon" aria-hidden>
              P
            </span>
            <span className="function-chip__label">停車</span>
          </button>
          {BOTTOM_KIND_ORDER.map((kind) => (
            <KindChip
              key={kind}
              kind={kind}
              count={counts[kind]}
              layerOn={layerVisibility ? layerVisibility[kind] : true}
              selected={selectedKind === kind}
              onClick={() => handleKind(kind)}
            />
          ))}
        </div>
      </div>
      {!compact ? (
        <p className="mt-1 max-w-[min(36rem,calc(100vw-0.75rem))] truncate text-center text-[10px] text-zinc-500">
          CCTV {cctvOriginLabel(origin)} · 災害 {disasterOriginLabel(disasterOrigin)}
        </p>
      ) : null}
    </section>
  );
}

function KindChip({
  kind,
  count,
  layerOn,
  selected,
  onClick,
}: {
  kind: RoadIntelKind;
  count: number;
  layerOn: boolean;
  selected: boolean;
  onClick: () => void;
}) {
  const meta = KIND_META[kind];
  const Icon = meta.icon;
  return (
    <button
      type="button"
      title={meta.label}
      aria-label={`${meta.label}${count}則`}
      aria-pressed={layerOn}
      onClick={onClick}
      className={cn(
        "function-chip relative flex items-center justify-center border touch-manipulation",
        layerOn ? meta.activeClass : meta.className,
        !layerOn && "opacity-55",
        selected && "ring-2 ring-white/30",
      )}
    >
      <Icon className="function-chip__icon" />
      <span className="function-chip__label">{meta.label}</span>
      <span className="function-chip__badge absolute flex min-w-4 items-center justify-center rounded-full bg-black/80 px-1 text-[10px] leading-4 text-zinc-200">
        {count}
      </span>
    </button>
  );
}

function FavoriteHeartButton({
  pressed,
  count,
  onToggle,
}: {
  pressed: boolean;
  count: number;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      aria-label="最愛書籤"
      aria-pressed={pressed}
      title="最愛書籤"
      onClick={onToggle}
      className={cn(
        "function-chip relative flex items-center justify-center border touch-manipulation",
        pressed
          ? "border-rose-300/80 bg-rose-500/35 text-rose-100"
          : "border-rose-400/40 bg-rose-500/15 text-rose-200 hover:bg-rose-500/30",
      )}
    >
      <Heart className={cn("function-chip__icon", pressed && "fill-rose-500")} strokeWidth={1.75} />
      <span className="function-chip__label">最愛</span>
      {count > 0 ? (
        <span className="function-chip__badge absolute flex min-w-4 items-center justify-center rounded-full bg-black/80 px-1 text-[10px] leading-4 text-zinc-200">
          {count}
        </span>
      ) : null}
    </button>
  );
}

function YouTubeMusicIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <rect width="24" height="24" rx="6" fill="#FF0033" />
      <path d="M8.7 6.8v10.4L18.4 12 8.7 6.8z" fill="#fff" />
    </svg>
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
        "function-chip relative flex items-center justify-center border touch-manipulation",
        pressed
          ? "border-red-300/70 bg-[#ff0033]/40 text-white"
          : "border-red-400/35 bg-[#ff0033]/20 text-red-100 hover:bg-[#ff0033]/35",
      )}
    >
      <YouTubeMusicIcon className="function-chip__icon rounded-[0.28rem]" />
      <span className="function-chip__label">音樂</span>
    </button>
  );
}

