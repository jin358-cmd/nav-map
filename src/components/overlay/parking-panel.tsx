"use client";

import { Navigation, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
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

const SORT_BUTTONS: Array<{ value: ParkingSort; label: string }> = [
  { value: "distance", label: "距離" },
  { value: "price", label: "費率" },
  { value: "remaining", label: "格數" },
];

function spacesLabel(lot: ParkingLot) {
  if (lot.availabilityStatus === "unknown" || lot.carAvailable == null) {
    return "格數未提供";
  }
  if (lot.availabilityStatus === "stale") {
    return `${lot.carAvailable}格（可能過期）`;
  }
  return `${lot.carAvailable}格`;
}

function ownershipName(lot: ParkingLot) {
  return `${parkingOwnershipLabel(lot.publicLot)} ${lot.name}`;
}

function lotLine(lot: ParkingLot) {
  return [
    lot.distanceMeters != null ? formatDistance(lot.distanceMeters) : "距離未提供",
    ownershipName(lot),
    formatParkingRate(lot),
    spacesLabel(lot),
  ].join(" · ");
}

function cityFromOrigin(origin: ParkingCatalog["origin"]) {
  if (origin === "tainan-open") return "臺南市";
  if (origin === "taipei-open") return "臺北市";
  return "";
}

function parkingUpdateTitle(
  city: string | undefined,
  origin: ParkingCatalog["origin"],
  fetchedAt?: string | null,
) {
  const area = (city || cityFromOrigin(origin)).replaceAll("台", "臺");
  const ago = fetchedAt ? formatUpdatedAgo(fetchedAt) : "剛剛";
  return area
    ? `${area}公有/民營停車場更新・${ago}`
    : `公有/民營停車場更新・${ago}`;
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
  city,
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
  city?: string;
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
    <section className="pointer-events-auto w-full max-w-xl rounded-2xl border border-white/15 bg-black/80 p-3 text-white shadow-[0_12px_50px_rgba(0,0,0,0.5)] backdrop-blur-xl">
      <div className="mb-2 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold tracking-wide text-zinc-100">
            {parkingUpdateTitle(city, origin, fetchedAt)}
          </p>
          {onToggleArrivalPrompt ? (
            <div className="mt-1.5 flex items-center gap-1.5">
              <p className="text-[11px] text-zinc-200">到達前提醒</p>
              <button
                type="button"
                role="switch"
                aria-checked={arrivalPromptEnabled}
                aria-label={`到達前提醒 ${arrivalPromptEnabled ? "ON" : "OFF"}`}
                onClick={() => onToggleArrivalPrompt(!arrivalPromptEnabled)}
                className={cn(
                  "relative inline-flex h-4 w-8 shrink-0 items-center rounded-full px-0.5 touch-manipulation",
                  arrivalPromptEnabled ? "bg-emerald-500" : "bg-red-500",
                )}
              >
                <span
                  className={cn(
                    "size-3 rounded-full bg-white shadow transition-transform",
                    arrivalPromptEnabled ? "translate-x-3.5" : "translate-x-0",
                  )}
                />
              </button>
              <span
                className={cn(
                  "text-[10px] font-semibold",
                  arrivalPromptEnabled ? "text-emerald-300" : "text-red-300",
                )}
              >
                {arrivalPromptEnabled ? "ON" : "OFF"}
              </span>
            </div>
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
        {SORT_BUTTONS.map((item) => (
          <button
            key={item.value}
            type="button"
            onClick={() => onSort(item.value)}
            className={cn(
              "h-9 rounded-full px-3 text-xs touch-manipulation",
              sort === item.value ? "bg-sky-400 text-[#041016]" : "bg-white/10 text-zinc-200",
            )}
          >
            {item.label}
          </button>
        ))}
      </div>
      {detail ? (
        <article className="mb-2 rounded-xl bg-white/8 p-2.5">
          <p className="truncate text-sm font-semibold text-zinc-100">
            {lotLine(detail)}
          </p>
          <p className="mt-1 truncate text-[11px] text-zinc-500">
            {formatTaiwanDisplayAddress(detail.address) || "地址未提供"}
          </p>
          <Button
            type="button"
            onClick={() => onNavigate(detail)}
            className="mt-2 h-11 w-full rounded-xl bg-sky-400 text-[#041016] hover:bg-sky-300 touch-manipulation"
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
                  selected?.id === lot.id ? "bg-white/12" : "hover:bg-white/8",
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
                <span className="min-w-0 flex-1 truncate text-[13px] text-zinc-100">
                  {lotLine(lot)}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
