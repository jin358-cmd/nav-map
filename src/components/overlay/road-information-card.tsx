"use client";

import { useMemo, useState } from "react";
import {
  Check,
  CircleParking,
  Heart,
  MapPin,
  Music2,
  Pencil,
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
import { cctvOriginLabel, disasterOriginLabel } from "@/lib/format";
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
  canFavorite = false,
  isCurrentFavorite = false,
  routeAlert = null,
  compact = true,
  onHeartClick,
  onAddFavorite,
  onCloseFavorites,
  onSelectFavorite,
  onRemoveFavorite,
  onRenameFavorite,
  account = null,
  accountBusy = false,
  accountHint = null,
  accountConfigured = false,
  accountUnavailable = false,
  onSignIn,
  onSignOut,
  parkingOn = false,
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
  canFavorite?: boolean;
  isCurrentFavorite?: boolean;
  onHeartClick?: () => void;
  onAddFavorite?: () => void;
  onCloseFavorites?: () => void;
  onSelectFavorite?: (hit: GeocodeHit) => void;
  onRemoveFavorite?: (hit: GeocodeHit) => void;
  onRenameFavorite?: (hit: GeocodeHit, name: string) => void;
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
    <section className="pointer-events-auto relative inline-flex flex-col items-end text-white">
      <div className="mb-1.5 flex w-full items-center justify-end gap-2 px-0.5">
        <p className="text-[11px] tracking-wide text-zinc-300">功能選單</p>
      </div>
      {favoritesOpen ? (
        <div className="absolute bottom-full right-0 z-30 mb-2 w-[min(20rem,calc(100vw-1.25rem))]">
          <FavoritesPanel
            favorites={favorites}
            canFavorite={canFavorite}
            isCurrentFavorite={isCurrentFavorite}
            onAddCurrent={onAddFavorite}
            onSelect={onSelectFavorite}
            onRemove={onRemoveFavorite}
            onRename={onRenameFavorite}
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

      <div className="inline-flex flex-col items-end gap-1.5 rounded-2xl border border-zinc-500/40 bg-zinc-900/88 px-1.5 py-1.5 shadow-[0_10px_32px_rgba(0,0,0,0.4)] backdrop-blur-xl">
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
            aria-label="停車"
            aria-pressed={parkingOn}
            onClick={() => {
              onPreviewOpen?.();
              onToggleParking?.();
            }}
            className={cn(
              "function-chip relative flex items-center justify-center border touch-manipulation",
              parkingOn
                ? "border-emerald-300/70 bg-emerald-500/30 text-emerald-100"
                : "border-emerald-400/35 bg-emerald-500/15 text-emerald-200",
              !parkingOn && "opacity-80",
            )}
          >
            <CircleParking className="function-chip__icon" />
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

function FavoritesPanel({
  favorites,
  canFavorite,
  isCurrentFavorite,
  onAddCurrent,
  onSelect,
  onRemove,
  onRename,
  onClose,
}: {
  favorites: GeocodeHit[];
  canFavorite: boolean;
  isCurrentFavorite: boolean;
  onAddCurrent?: () => void;
  onSelect?: (hit: GeocodeHit) => void;
  onRemove?: (hit: GeocodeHit) => void;
  onRename?: (hit: GeocodeHit, name: string) => void;
  onClose?: () => void;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");

  const commitRename = (hit: GeocodeHit) => {
    const next = draft.trim();
    if (next) onRename?.(hit, next);
    setEditingId(null);
    setDraft("");
  };

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
          {favorites.map((hit) => {
            const editing = editingId === hit.id;
            return (
              <li key={hit.id} className="flex items-start gap-0.5">
                {editing ? (
                  <div className="flex min-w-0 flex-1 items-center gap-1 px-1 py-1">
                    <input
                      autoFocus
                      value={draft}
                      onChange={(event) => setDraft(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") commitRename(hit);
                        if (event.key === "Escape") {
                          setEditingId(null);
                          setDraft("");
                        }
                      }}
                      aria-label="書籤名稱"
                      className="h-8 min-w-0 flex-1 rounded-lg border border-rose-300/30 bg-white/8 px-2 text-sm text-white outline-none"
                    />
                    <button
                      type="button"
                      aria-label="儲存名稱"
                      onClick={() => commitRename(hit)}
                      className="flex size-7 shrink-0 items-center justify-center rounded-lg text-rose-200 hover:bg-white/10 touch-manipulation"
                    >
                      <Check className="size-3.5" />
                    </button>
                    <button
                      type="button"
                      aria-label="取消編輯"
                      onClick={() => {
                        setEditingId(null);
                        setDraft("");
                      }}
                      className="flex size-7 shrink-0 items-center justify-center rounded-lg text-zinc-400 hover:bg-white/10 hover:text-white touch-manipulation"
                    >
                      <X className="size-3.5" />
                    </button>
                  </div>
                ) : (
                  <>
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
                      aria-label={`編輯${hit.name}名稱`}
                      onClick={() => {
                        setEditingId(hit.id);
                        setDraft(hit.name);
                      }}
                      className="mt-1 flex size-7 shrink-0 items-center justify-center rounded-lg text-zinc-400 hover:bg-white/10 hover:text-white touch-manipulation"
                    >
                      <Pencil className="size-3.5" />
                    </button>
                    <button
                      type="button"
                      aria-label={`移除${hit.name}`}
                      onClick={() => onRemove?.(hit)}
                      className="mt-1 flex size-7 shrink-0 items-center justify-center rounded-lg text-zinc-500 hover:bg-white/10 hover:text-white touch-manipulation"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </>
                )}
              </li>
            );
          })}
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
        "function-chip relative flex items-center justify-center border touch-manipulation",
        pressed
          ? "border-red-300/70 bg-[#ff0033]/40 text-white"
          : "border-red-400/35 bg-[#ff0033]/20 text-red-100 hover:bg-[#ff0033]/35",
      )}
    >
      <Music2 className="function-chip__icon" strokeWidth={1.75} />
      <span className="function-chip__label">音樂</span>
    </button>
  );
}

