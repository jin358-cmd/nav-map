"use client";

import { Navigation, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  eventOriginLabel,
  formatDistance,
  formatParkingRate,
  formatUpdatedAgo,
} from "@/lib/format";
import { parkingOwnershipLabel } from "@/lib/parking/brands";
import { formatTaiwanDisplayAddress } from "@/lib/geocoding/format-taiwan-display-address";
import { sortParkingLots } from "@/lib/parking-sort";
import { cn } from "@/lib/utils";
import type {
  ParkingCatalog,
  ParkingLot,
  ParkingSort,
} from "@/types/domain";

function remainingLabel(lot: ParkingLot) {
  if (lot.availabilityStatus === "unknown" || lot.carAvailable == null) {
    return "即時剩餘車位目前無資料";
  }
  if (lot.availabilityStatus === "stale") {
    return `${lot.carAvailable} 格（資料可能過期）`;
  }
  return `${lot.carAvailable} 格`;
}

function markerClass(lot: ParkingLot) {
  if (lot.fill === "plenty") return "bg-emerald-400";
  if (lot.fill === "limited") return "bg-amber-300";
  if (lot.fill === "full") return "bg-red-400";
  return "bg-zinc-400";
}

export function ParkingPanel({
  lots,
  origin,
  fetchedAt,
  loading = false,
  selected,
  sort,
  onSort,
  onSelect,
  onNavigate,
  onClose,
  arrivalPromptEnabled = true,
  onToggleArrivalPrompt,
}: {
  lots: ParkingLot[];
  origin: ParkingCatalog["origin"];
  fetchedAt?: string | null;
  loading?: boolean;
  selected: ParkingLot | null;
  sort: ParkingSort;
  onSort: (sort: ParkingSort) => void;
  onSelect: (lot: ParkingLot) => void;
  onNavigate: (lot: ParkingLot) => void;
  onClose: () => void;
  arrivalPromptEnabled?: boolean;
  onToggleArrivalPrompt?: (enabled: boolean) => void;
}) {
  const ranked = sortParkingLots(lots, sort);
  const detail = selected;
  return (
    <section className="pointer-events-auto w-full max-w-xl rounded-2xl border border-emerald-300/20 bg-black/78 p-3 text-white shadow-[0_12px_50px_rgba(0,0,0,0.5)] backdrop-blur-xl">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[11px] tracking-wide text-emerald-200">附近停車場</p>
          <p className="truncate text-[11px] text-zinc-500">
            {eventOriginLabel(origin)} · {fetchedAt ? formatUpdatedAgo(fetchedAt) : "未提供"}
          </p>
          {onToggleArrivalPrompt ? (
            <button
              type="button"
              aria-pressed={arrivalPromptEnabled}
              onClick={() => onToggleArrivalPrompt(!arrivalPromptEnabled)}
              className="mt-1 text-left text-[11px] text-emerald-100/90 hover:text-white touch-manipulation"
            >
              到達前停車提醒 {arrivalPromptEnabled ? "ON" : "OFF"}
            </button>
          ) : null}
        </div>
        <button
          type="button"
          aria-label="關閉停車場"
          onClick={onClose}
          className="flex size-11 shrink-0 items-center justify-center rounded-lg text-zinc-400 hover:bg-white/10 touch-manipulation"
        >
          <X className="size-4" />
        </button>
      </div>
      <div className="mb-2 flex gap-1.5">
        {(["distance", "remaining", "price"] as const).map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => onSort(value)}
            className={cn(
              "h-9 rounded-full px-3 text-xs touch-manipulation",
              sort === value ? "bg-emerald-400 text-[#041016]" : "bg-white/8 text-zinc-300",
            )}
          >
            {value === "distance" ? "距離最近" : value === "remaining" ? "剩餘最多" : "費率最低"}
          </button>
        ))}
      </div>
      {detail ? (
        <article className="mb-2 rounded-xl bg-white/5 p-2.5">
          <h2 className="truncate text-sm font-semibold">{detail.name}</h2>
          <p className="truncate text-[11px] text-zinc-400">
            {parkingOwnershipLabel(detail.publicLot)}
            {detail.brand ? ` · ${detail.brand}` : ""}
            {" · "}
            {formatTaiwanDisplayAddress(detail.address) || "地址未提供"}
          </p>
          <dl className="mt-2 grid grid-cols-2 gap-2 text-xs">
            <Info
              label="距離"
              value={detail.distanceMeters != null ? formatDistance(detail.distanceMeters) : "未提供"}
            />
            <Info label="剩餘" value={remainingLabel(detail)} />
            <Info
              label="總車位"
              value={detail.carTotal != null ? `${detail.carTotal} 格` : "未提供"}
            />
            <Info label="費率" value={formatParkingRate(detail)} />
            <Info label="最後更新" value={formatUpdatedAgo(detail.updatedAt)} />
            <Info
              label="空位"
              value={
                detail.fill === "full"
                  ? "已滿"
                  : detail.fill === "unknown"
                    ? "即時剩餘車位目前無資料"
                    : "仍有空位"
              }
            />
          </dl>
          <Button
            type="button"
            onClick={() => onNavigate(detail)}
            className="mt-2 h-11 w-full rounded-xl bg-emerald-400 text-[#041016] hover:bg-emerald-300 touch-manipulation"
          >
            <Navigation className="size-4" />
            導航前往
          </Button>
        </article>
      ) : null}
      {loading && ranked.length === 0 ? (
        <div
          className="flex flex-col items-center justify-center gap-2 px-1 py-6 text-sm text-sky-100"
          role="status"
          aria-live="polite"
        >
          <span className="parking-panel-spinner" aria-hidden />
          正在搜尋附近停車場…
        </div>
      ) : ranked.length === 0 ? (
        <p className="px-1 py-3 text-sm text-zinc-300">
          {origin === "unavailable" ? "資料暫時無法取得" : "附近沒有停車場資料"}
        </p>
      ) : (
        <ul className="max-h-40 overflow-y-auto">
          {ranked.map((lot) => (
            <li key={lot.id}>
              <button
                type="button"
                onClick={() => onSelect(lot)}
                className={cn(
                  "flex w-full items-center gap-2 rounded-xl px-2 py-2 text-left touch-manipulation",
                  selected?.id === lot.id ? "bg-emerald-500/20" : "hover:bg-white/8",
                )}
              >
                <span
                  className={cn(
                    "flex size-9 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold text-[#041016]",
                    markerClass(lot),
                  )}
                >
                  {lot.carAvailable == null ? "P?" : `P${Math.max(0, lot.carAvailable)}`}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm">{lot.name}</span>
                  <span className="block truncate text-[11px] text-zinc-500">
                    {lot.distanceMeters != null ? formatDistance(lot.distanceMeters) : "未提供"}
                    {" · "}
                    {parkingOwnershipLabel(lot.publicLot)}
                    {lot.brand ? ` · ${lot.brand}` : ""}
                    {" · "}
                    {remainingLabel(lot)}
                    {" · "}
                    {formatParkingRate(lot)}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-lg bg-black/30 px-2 py-1.5">
      <dt className="text-[10px] text-zinc-500">{label}</dt>
      <dd className="truncate text-zinc-200">{value}</dd>
    </div>
  );
}
