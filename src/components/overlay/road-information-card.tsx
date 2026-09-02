"use client";

import { useMemo, useState } from "react";
import {
  AlertTriangle,
  Camera,
  Construction,
  Heart,
  MapPin,
  TrafficCone,
  Trash2,
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
  GeocodeHit,
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
  favorites = [],
  favoritesOpen = false,
  canFavorite = false,
  isCurrentFavorite = false,
  onHeartClick,
  onAddFavorite,
  onCloseFavorites,
  onSelectFavorite,
  onRemoveFavorite,
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
  favorites?: GeocodeHit[];
  favoritesOpen?: boolean;
  canFavorite?: boolean;
  isCurrentFavorite?: boolean;
  onHeartClick?: () => void;
  onAddFavorite?: () => void;
  onCloseFavorites?: () => void;
  onSelectFavorite?: (hit: GeocodeHit) => void;
  onRemoveFavorite?: (hit: GeocodeHit) => void;
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
      {favoritesOpen ? (
        <FavoritesPanel
          favorites={favorites}
          canFavorite={canFavorite}
          isCurrentFavorite={isCurrentFavorite}
          onAddCurrent={onAddFavorite}
          onSelect={onSelectFavorite}
          onRemove={onRemoveFavorite}
          onClose={() => onCloseFavorites?.()}
        />
      ) : previewItem ? (
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
      aria-label={pressed ? "最愛書籤" : "加入最愛"}
      aria-pressed={pressed}
      title="加入最愛"
      onClick={onToggle}
      className={cn(
        "relative flex size-10 items-center justify-center rounded-full border touch-manipulation",
        pressed
          ? "border-rose-300/80 bg-rose-500/35 text-rose-100"
          : "border-rose-400/40 bg-rose-500/15 text-rose-200 hover:bg-rose-500/30",
      )}
    >
      <Heart className={cn("size-5", pressed && "fill-rose-500")} />
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
    <div className="mb-2 w-fit max-w-[19rem] rounded-2xl border border-white/10 bg-black/70 px-2.5 py-2 shadow-[0_12px_40px_rgba(0,0,0,0.45)] backdrop-blur-xl">
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
        <p className="px-1 py-2 text-[12px] text-zinc-400">
          搜尋或長按地圖後，可把已輸入的位置存成書籤。
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
                  <span className="block truncate text-sm">{hit.name}</span>
                  <span className="block truncate text-[11px] text-zinc-500">
                    {hit.address}
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
