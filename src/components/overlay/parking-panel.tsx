"use client";

import { Navigation } from "lucide-react";
import { Button } from "@/components/ui/button";
import { HudCloseButton } from "@/components/overlay/hud-close-button";
import {
  formatDistance,
  formatParkingRate,
  formatUpdatedAgo,
} from "@/lib/format";
import { parkingOwnershipLabel } from "@/lib/parking/brands";
import {
  formatTaiwanRoadName,
  formatTaiwanStreetName,
} from "@/lib/geocoding/format-taiwan-display-address";
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

function parkingUpdateLines(
  city: string | undefined,
  origin: ParkingCatalog["origin"],
  fetchedAt?: string | null,
) {
  const area = (city || cityFromOrigin(origin)).replaceAll("台", "臺");
  const ago = fetchedAt ? formatUpdatedAgo(fetchedAt) : "剛剛";
  return {
    title: area ? `${area}公有／民營停車場` : "公有／民營停車場",
    updated: `更新・${ago}`,
  };
}

function markerClass(lot: ParkingLot) {
  if (lot.fill === "plenty") return "bg-emerald-400";
  if (lot.fill === "limited") return "bg-amber-300";
  if (lot.fill === "full") return "bg-red-400";
  return "bg-zinc-400";
}

function spacesBadge(lot: ParkingLot) {
  if (lot.carAvailable == null || lot.availabilityStatus === "unknown") {
    return "—格";
  }
  return `${Math.max(0, lot.carAvailable)}格`;
}

function parkingNameLine(lot: ParkingLot) {
  const tag = parkingOwnershipLabel(lot.publicLot);
  const name = lot.name.replace(/^(公有|民營|公營)\s*/u, "").trim() || lot.name;
  return `${tag} ${name}`;
}

function parkingRoad(lot: ParkingLot) {
  return (
    formatTaiwanRoadName(lot.address) ||
    formatTaiwanRoadName(lot.name) ||
    formatTaiwanStreetName(lot.address) ||
    lot.name
  );
}

function occupancyLabel(lot: ParkingLot) {
  if (lot.carAvailable == null || lot.availabilityStatus === "unknown") {
    return null;
  }
  return `${Math.max(0, lot.carAvailable)} 格`;
}

function parkingLotCopy(lot: ParkingLot, sort: ParkingSort) {
  const distance =
    lot.distanceMeters != null ? formatDistance(lot.distanceMeters) : "距離未提供";
  const road = parkingRoad(lot);
  if (sort === "price") {
    return {
      primary: [distance, formatParkingRate(lot)].filter(Boolean).join("・"),
      secondary: road,
    };
  }
  if (sort === "remaining") {
    return {
      primary: [occupancyLabel(lot), distance].filter(Boolean).join("・"),
      secondary: road,
    };
  }
  return {
    primary: [distance, parkingNameLine(lot)].filter(Boolean).join("・"),
    secondary: road,
  };
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
  minimized = false,
  onExpand,
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
  minimized?: boolean;
  onExpand?: () => void;
  arrivalPromptEnabled?: boolean;
  onToggleArrivalPrompt?: (enabled: boolean) => void;
}) {
  const ranked = sortParkingLots(lots, sort);
  const header = parkingUpdateLines(city, origin, fetchedAt);
  return (
    <section
      className={cn(
        "pointer-events-auto hud-float-panel w-full max-w-xl rounded-2xl p-3 text-white",
        minimized && "cursor-pointer [&_*]:pointer-events-none",
      )}
      onClick={
        minimized
          ? (event) => {
              event.stopPropagation();
              onExpand?.();
            }
          : undefined
      }
    >
      <div className="mb-2 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-semibold leading-tight tracking-wide text-zinc-100">
            {header.title}
          </p>
          <p className="mt-0.5 text-[11px] leading-tight text-zinc-400">
            {header.updated}
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
        <HudCloseButton
          label="關閉停車場"
          onClick={(event) => {
            event.stopPropagation();
            onClose();
          }}
        />
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
          className="flex min-h-[14.5rem] flex-col items-center justify-center gap-2 px-1 py-6 text-sm text-sky-100"
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
        <ul className="max-h-[14.5rem] min-h-[14.5rem] space-y-2 overflow-y-auto">
          {ranked.map((lot) => {
            const copy = parkingLotCopy(lot, sort);
            return (
            <li key={lot.id}>
              <div
                className={cn(
                  "flex items-center gap-2 rounded-xl border px-2.5 py-2",
                  selected?.id === lot.id
                    ? "border-amber-300/55 bg-amber-400/18"
                    : "border-sky-300/25 bg-sky-950/55",
                )}
              >
                <span
                  className={cn(
                    "flex size-11 shrink-0 items-center justify-center rounded-full px-0.5 text-center text-[10px] font-semibold leading-tight text-[#041016]",
                    markerClass(lot),
                  )}
                >
                  {spacesBadge(lot)}
                </span>
                <div className="min-w-0 flex-1">
                  <button
                    type="button"
                    onClick={() => onSelect(lot)}
                    className="w-full text-left text-[13px] font-semibold text-yellow-300 touch-manipulation"
                  >
                    <span className="flex flex-col leading-snug">
                      <span className="truncate">{copy.primary}</span>
                      <span className="truncate text-[12px] font-medium text-yellow-200/90">
                        {copy.secondary}
                      </span>
                    </span>
                  </button>
                  <Button
                    type="button"
                    onClick={() => onNavigate(lot)}
                    className="mt-1.5 h-10 w-full rounded-xl bg-sky-300 text-[#041016] hover:bg-sky-200 touch-manipulation"
                  >
                    <Navigation className="size-4" />
                    導航前往
                  </Button>
                </div>
              </div>
            </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
