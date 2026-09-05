"use client";

import { useMemo, useState } from "react";
import {
  Heart,
  MapPin,
  Trash2,
  X,
} from "lucide-react";
import {
  AccidentTriangleIcon,
  CctvLensIcon,
  CongestionCarsIcon,
  ConstructionBarrierIcon,
  DisasterWarningIcon,
} from "@/components/overlay/status-icons";
import { AccountChip } from "@/components/overlay/account-chip";
import {
  cctvOriginLabel,
  disasterOriginLabel,
  trafficOriginLabel,
} from "@/lib/format";
import { formatTaiwanDisplayAddress } from "@/lib/geocoding/format-taiwan-display-address";
import type { GoogleAccount } from "@/lib/google-identity";
import { cn } from "@/lib/utils";
import type {
  CctvDataOrigin,
  DisasterDataOrigin,
  GeocodeHit,
  LayerKindVisibility,
  RoadIntelItem,
  RoadIntelKind,
  TrafficDataOrigin,
} from "@/types/domain";
import type { RouteAlert } from "@/lib/route-events";

const KIND_ORDER: RoadIntelKind[] = [
  "congestion",
  "cctv",
  "construction",
  "accident",
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
  trafficOrigin,
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
  canFavorite = false,
  isCurrentFavorite = false,
  routeAlert = null,
  compact = true,
  onHeartClick,
  onAddFavorite,
  onCloseFavorites,
  onSelectFavorite,
  onRemoveFavorite,
  account = null,
  accountBusy = false,
  accountHint = null,
  accountConfigured = false,
  accountUnavailable = false,
  onSignIn,
  onSignOut,
  navigating = false,
  cameraMode = "3d",
  onToggleCamera,
  onCancelNavigation,
}: {
  items: RoadIntelItem[];
  origin: CctvDataOrigin;
  trafficOrigin: TrafficDataOrigin;
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
  canFavorite?: boolean;
  isCurrentFavorite?: boolean;
  onHeartClick?: () => void;
  onAddFavorite?: () => void;
  onCloseFavorites?: () => void;
  onSelectFavorite?: (hit: GeocodeHit) => void;
  onRemoveFavorite?: (hit: GeocodeHit) => void;
  routeAlert?: RouteAlert | null;
  compact?: boolean;
  account?: GoogleAccount | null;
  accountBusy?: boolean;
  accountHint?: string | null;
  accountConfigured?: boolean;
  accountUnavailable?: boolean;
  onSignIn?: () => void;
  onSignOut?: () => void;
  navigating?: boolean;
  cameraMode?: "2d" | "3d";
  onToggleCamera?: () => void;
  onCancelNavigation?: () => void;
}) {
  const [openKind, setOpenKind] = useState<RoadIntelKind | null>(null);
  const selectedKind = activeKind ?? openKind;

  const groups = useMemo(
    () =>
      KIND_ORDER.map((kind) => ({
        kind,
        items: items.filter((item) => item.kind === kind),
      })),
    [items],
  );

  return (
    <section className="pointer-events-auto relative inline-flex flex-col items-center text-white">
      {navigating ? (
        <div className="mb-1.5 flex w-full max-w-[min(36rem,calc(100vw-1.25rem))] items-center justify-between gap-2 px-0.5">
          <p className="text-[11px] tracking-wide text-zinc-300">功能選單</p>
          <div className="flex items-center gap-1.5">
            {onToggleCamera ? (
              <button
                type="button"
                onClick={onToggleCamera}
                className="h-8 rounded-full border border-white/15 bg-black/45 px-2.5 text-[11px] text-zinc-100 touch-manipulation"
              >
                {cameraMode === "3d" ? "切換 2D" : "切換 3D"}
              </button>
            ) : null}
            {onCancelNavigation ? (
              <button
                type="button"
                onClick={onCancelNavigation}
                className="h-8 rounded-full border border-rose-300/45 bg-rose-600/85 px-3 text-[11px] font-semibold text-white touch-manipulation"
              >
                ✕ 取消導航
              </button>
            ) : null}
          </div>
        </div>
      ) : null}
      {favoritesOpen ? (
        <div className="absolute bottom-full left-1/2 z-30 mb-2 w-[min(20rem,calc(100vw-1.25rem))] -translate-x-1/2">
          <FavoritesPanel
            favorites={favorites}
            canFavorite={canFavorite}
            isCurrentFavorite={isCurrentFavorite}
            onAddCurrent={onAddFavorite}
            onSelect={onSelectFavorite}
            onRemove={onRemoveFavorite}
            onClose={() => onCloseFavorites?.()}
          />
        </div>
      ) : null}

      {routeAlert ? (
        <div className="mb-1.5 w-[min(22rem,calc(100vw-1.25rem))] rounded-2xl border border-amber-300/30 bg-zinc-900/90 px-3 py-2 text-left shadow-[0_10px_28px_rgba(0,0,0,0.45)]">
          <p className="truncate text-sm font-semibold text-amber-100">
            {routeAlert.emoji} {routeAlert.headline}
          </p>
          <p className="truncate text-[11px] text-zinc-400">{routeAlert.detail}</p>
        </div>
      ) : null}

      <div className="inline-flex w-full max-w-[min(36rem,calc(100vw-env(safe-area-inset-left)-env(safe-area-inset-right)-0.75rem))] items-center justify-center gap-1 rounded-full border border-zinc-500/40 bg-zinc-900/88 px-1 py-1 shadow-[0_10px_32px_rgba(0,0,0,0.4)] backdrop-blur-xl min-[431px]:w-fit min-[431px]:gap-1.5 min-[431px]:px-1.5">
        <div className="flex min-w-0 items-center gap-1 min-[431px]:gap-1.5">
          {groups.map((group) => {
            const meta = KIND_META[group.kind];
            const Icon = meta.icon;
            const layerOn = layerVisibility ? layerVisibility[group.kind] : true;
            const active = selectedKind === group.kind || layerOn;
            return (
              <button
                key={group.kind}
                type="button"
                title={meta.label}
                aria-label={`${meta.label}${group.items.length}則`}
                aria-pressed={layerOn}
                onClick={() => {
                  onPreviewOpen?.();
                  if (onKindClick) {
                    onKindClick(group.kind);
                    return;
                  }
                  setOpenKind((current) => {
                    const next = current === group.kind ? null : group.kind;
                    if (next && group.items[0]?.cameraId) {
                      onSelectCctv?.(group.items[0].cameraId);
                    }
                    return next;
                  });
                }}
                className={cn(
                  "relative flex size-9 items-center justify-center rounded-full border touch-manipulation min-[431px]:size-11",
                  layerOn ? meta.activeClass : meta.className,
                  !layerOn && "opacity-55",
                  active && selectedKind === group.kind && "ring-2 ring-white/30",
                )}
              >
                <Icon className="size-4 min-[431px]:size-5" />
                <span className="absolute -top-0.5 -right-0.5 flex min-w-4 items-center justify-center rounded-full bg-black/80 px-1 text-[10px] leading-4 text-zinc-200">
                  {group.items.length}
                </span>
              </button>
            );
          })}
        </div>
        <AccountChip
          account={account}
          busy={accountBusy}
          hint={accountHint}
          configured={accountConfigured}
          unavailable={accountUnavailable}
          onSignIn={() => onSignIn?.()}
          onSignOut={() => onSignOut?.()}
        />
        <div className="flex items-center gap-1 min-[431px]:gap-1.5">
          <FavoriteHeartButton
            pressed={favoritesOpen || isCurrentFavorite}
            count={favorites.length}
            onToggle={() => {
              setOpenKind(null);
              onHeartClick?.();
            }}
          />
          <YouTubeMusicButton
            pressed={musicOpen}
            onToggle={() => {
              setOpenKind(null);
              onToggleMusic?.();
            }}
          />
        </div>
      </div>
      {!compact ? (
        <p className="mt-1 max-w-[min(36rem,calc(100vw-0.75rem))] truncate text-center text-[10px] text-zinc-500">
          CCTV {cctvOriginLabel(origin)} · 路況 {trafficOriginLabel(trafficOrigin)} · 災害 {disasterOriginLabel(disasterOrigin)}
        </p>
      ) : null}
    </section>
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
        "relative flex size-9 items-center justify-center rounded-full border touch-manipulation min-[431px]:size-10",
        pressed
          ? "border-rose-300/80 bg-rose-500/35 text-rose-100"
          : "border-rose-400/40 bg-rose-500/15 text-rose-200 hover:bg-rose-500/30",
      )}
    >
      <Heart className={cn("size-4 min-[431px]:size-5", pressed && "fill-rose-500")} />
      {count > 0 ? (
        <span className="absolute -top-0.5 -right-0.5 flex min-w-4 items-center justify-center rounded-full bg-black/80 px-1 text-[10px] leading-4 text-zinc-200">
          {count}
        </span>
      ) : null}
    </button>
  );
}

function FavoritesPanel({
  favorites,
  canFavorite,
  isCurrentFavorite,
  onAddCurrent,
  onSelect,
  onRemove,
  onClose,
}: {
  favorites: GeocodeHit[];
  canFavorite: boolean;
  isCurrentFavorite: boolean;
  onAddCurrent?: () => void;
  onSelect?: (hit: GeocodeHit) => void;
  onRemove?: (hit: GeocodeHit) => void;
  onClose?: () => void;
}) {
  return (
    <div className="w-full rounded-2xl border border-rose-300/25 bg-black/82 px-2.5 py-2 shadow-[0_12px_40px_rgba(0,0,0,0.55)] backdrop-blur-xl">
      <div className="mb-1 flex items-center justify-between gap-2">
        <p className="text-[11px] tracking-wide text-rose-200/90">最愛書籤</p>
        <button
          type="button"
          aria-label="收合最愛"
          onClick={onClose}
          className="flex size-7 shrink-0 items-center justify-center rounded-lg text-zinc-400 hover:bg-white/10 hover:text-white touch-manipulation"
        >
          <X className="size-3.5" />
        </button>
      </div>
      {canFavorite && !isCurrentFavorite ? (
        <button
          type="button"
          onClick={onAddCurrent}
          className="mb-1.5 flex w-full items-center gap-2 rounded-xl border border-rose-300/25 bg-rose-500/15 px-2 py-1.5 text-left text-sm text-rose-100 hover:bg-rose-500/25 touch-manipulation"
        >
          <Heart className="size-4 fill-rose-500" />
          加入目前位置
        </button>
      ) : null}
      {favorites.length === 0 ? (
        <p className="px-1 py-2 text-sm text-zinc-300">
          還沒有書籤。搜尋店家或長按地圖後，再點紅心即可加入最愛。
        </p>
      ) : (
        <ul className="max-h-44 overflow-y-auto">
          {favorites.map((hit) => (
            <li key={hit.id} className="flex items-start">
              <button
                type="button"
                onClick={() => onSelect?.(hit)}
                className="flex min-w-0 flex-1 items-start gap-2 px-1 py-1.5 text-left hover:bg-white/8 touch-manipulation"
              >
                <MapPin className="mt-0.5 size-3.5 shrink-0 text-rose-300" />
                <span className="min-w-0">
                  <span className="block truncate text-sm">
                    {formatTaiwanDisplayAddress(hit.name)}
                  </span>
                  <span className="block truncate text-[11px] text-zinc-500">
                    {formatTaiwanDisplayAddress(hit.address)}
                  </span>
                </span>
              </button>
              <button
                type="button"
                aria-label={`移除${hit.name}`}
                onClick={() => onRemove?.(hit)}
                className="mt-1 flex size-7 shrink-0 items-center justify-center rounded-lg text-zinc-500 hover:bg-white/10 hover:text-white touch-manipulation"
              >
                <Trash2 className="size-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
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
        "relative flex size-9 items-center justify-center rounded-full border touch-manipulation min-[431px]:size-10",
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
