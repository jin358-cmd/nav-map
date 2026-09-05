"use client";

import { Navigation, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  eventOriginLabel,
  formatDistance,
  formatUpdatedAt,
  freshnessLabel,
  providedText,
} from "@/lib/format";
import { formatTaiwanDisplayAddress } from "@/lib/geocoding/format-taiwan-display-address";
import { sortParkingLots } from "@/lib/parking-sort";
import { cn } from "@/lib/utils";
import type {
  ParkingCatalog,
  ParkingLot,
  ParkingSort,
} from "@/types/domain";

const FILL_LABEL = {
  plenty: "車位充足",
  limited: "剩餘不多",
  full: "已滿",
  unknown: "車位資訊未提供",
} as const;

export function ParkingPanel({
  lots,
  origin,
  fetchedAt,
  selected,
  sort,
  onSort,
  onSelect,
  onNavigate,
  onClose,
}: {
  lots: ParkingLot[];
  origin: ParkingCatalog["origin"];
  fetchedAt?: string | null;
  selected: ParkingLot | null;
  sort: ParkingSort;
  onSort: (sort: ParkingSort) => void;
  onSelect: (lot: ParkingLot) => void;
  onNavigate: (lot: ParkingLot) => void;
  onClose: () => void;
}) {
  const ranked = sortParkingLots(lots, sort);
  const detail = selected;
  return (
    <section className="pointer-events-auto w-full max-w-xl rounded-2xl border border-emerald-300/20 bg-black/78 p-3 text-white shadow-[0_12px_50px_rgba(0,0,0,0.5)] backdrop-blur-xl">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div>
          <p className="text-[11px] tracking-wide text-emerald-200">附近停車</p>
          <p className="text-[11px] text-zinc-500">
            {eventOriginLabel(origin)} · {fetchedAt ? formatUpdatedAt(fetchedAt) : "未提供"}
          </p>
        </div>
        <button
          type="button"
          aria-label="關閉停車場"
          onClick={onClose}
          className="flex size-11 items-center justify-center rounded-lg text-zinc-400 hover:bg-white/10 touch-manipulation"
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
            {value === "distance" ? "距離" : value === "remaining" ? "剩餘車位" : "價格"}
          </button>
        ))}
      </div>
      {detail ? (
        <article className="mb-2 rounded-xl bg-white/5 p-2.5">
          <h2 className="truncate text-sm font-semibold">{detail.name}</h2>
          <p className="truncate text-[11px] text-zinc-400">
            {providedText(formatTaiwanDisplayAddress(detail.address))}
          </p>
          <dl className="mt-2 grid grid-cols-2 gap-2 text-xs">
            <Info label="距離" value={detail.distanceMeters != null ? formatDistance(detail.distanceMeters) : "未提供"} />
            <Info
              label="汽車車位"
              value={
                detail.carAvailable == null && detail.carTotal == null
                  ? "車位資訊未提供"
                  : `${detail.carAvailable ?? "未提供"} / ${detail.carTotal ?? "未提供"}`
              }
            />
            <Info
              label="機車車位"
              value={
                detail.motorcycleAvailable == null && detail.motorcycleTotal == null
                  ? "車位資訊未提供"
                  : `${detail.motorcycleAvailable ?? "未提供"} / ${detail.motorcycleTotal ?? "未提供"}`
              }
            />
            <Info label="收費" value={providedText(detail.fee)} />
            <Info label="營業時間" value={providedText(detail.hours)} />
            <Info label="狀態" value={`${FILL_LABEL[detail.fill]} · ${freshnessLabel(detail.freshness)}`} />
          </dl>
          <p className="mt-2 text-[11px] text-zinc-500">
            最後更新 {detail.updatedAt ? formatUpdatedAt(detail.updatedAt) : "未提供"} · {providedText(detail.source)}
          </p>
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
      {ranked.length === 0 ? (
        <p className="px-1 py-3 text-sm text-zinc-300">
          {origin === "unavailable" ? "資料暫時無法取得" : "目的地附近沒有停車場資料"}
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
                    lot.fill === "plenty" && "bg-emerald-400",
                    lot.fill === "limited" && "bg-amber-300",
                    lot.fill === "full" && "bg-red-400",
                    lot.fill === "unknown" && "bg-zinc-400",
                  )}
                >
                  P{lot.carAvailable ?? "?"}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm">{lot.name}</span>
                  <span className="block truncate text-[11px] text-zinc-500">
                    {FILL_LABEL[lot.fill]} · {lot.distanceMeters != null ? formatDistance(lot.distanceMeters) : "未提供"}
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
