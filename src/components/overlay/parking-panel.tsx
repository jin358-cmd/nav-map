"use client";

import { Navigation, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  formatDistance,
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
    ? `${area}公有／民營停車場(更新・${ago})`
    : `公有／民營停車場(更新・${ago})`;
}

function yellowLotLine(lot: ParkingLot) {
  const distance =
    lot.distanceMeters != null ? formatDistance(lot.distanceMeters) : "距離未提供";
  const place =
    formatTaiwanDisplayAddress(lot.address) ||
    `${parkingOwnershipLabel(lot.publicLot)} ${lot.name}`;
  const spaces =
    lot.carAvailable == null || lot.availabilityStatus === "unknown"
      ? "(約—格)"
      : `(約${lot.carAvailable}格)`;
  return `${distance}・${place}・${spaces}`;
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
        <ul className="max-h-52 space-y-2 overflow-y-auto">
          {ranked.map((lot) => (
            <li key={lot.id}>
              <div
                className={cn(
                  "rounded-xl border px-2.5 py-2",
                  selected?.id === lot.id
                    ? "border-amber-300/55 bg-amber-400/18"
                    : "border-sky-300/25 bg-sky-950/55",
                )}
              >
                <button
                  type="button"
                  onClick={() => onSelect(lot)}
                  className="w-full truncate text-left text-[13px] font-semibold text-yellow-300 touch-manipulation"
                >
                  {yellowLotLine(lot)}
                </button>
                <Button
                  type="button"
                  onClick={() => onNavigate(lot)}
                  className="mt-1.5 h-10 w-full rounded-xl bg-yellow-300 text-[#041016] hover:bg-yellow-200 touch-manipulation"
                >
                  <Navigation className="size-4" />
                  導航前往
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
