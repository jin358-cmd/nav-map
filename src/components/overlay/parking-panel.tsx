"use client";

import { useState } from "react";
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
import { PARKING_FEE_LABEL, parkingFeeLayerColor } from "@/lib/parking-meta";
import { sortParkingLots } from "@/lib/parking-sort";
import { cn } from "@/lib/utils";
import type {
  ParkingCatalog,
  ParkingFilter,
  ParkingLot,
  ParkingSort,
} from "@/types/domain";

const FILL_LABEL = {
  plenty: "車位充足",
  limited: "剩餘不多",
  full: "已滿",
  unknown: "車位資訊未提供",
} as const;

function matchesFilter(lot: ParkingLot, filter: ParkingFilter) {
  if (filter === "registered") return lot.registered;
  if (filter === "paid") return lot.feeClass === "paid";
  if (filter === "free") return lot.feeClass === "free";
  return true;
}

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
  arrivalPromptEnabled = true,
  onToggleArrivalPrompt,
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
  arrivalPromptEnabled?: boolean;
  onToggleArrivalPrompt?: (enabled: boolean) => void;
}) {
  const [filter, setFilter] = useState<ParkingFilter>("all");
  const ranked = sortParkingLots(lots.filter((lot) => matchesFilter(lot, filter)), sort);
  const detail = selected && matchesFilter(selected, filter) ? selected : null;
  return (
    <section className="pointer-events-auto w-full max-w-xl rounded-2xl border border-emerald-300/20 bg-black/78 p-3 text-white shadow-[0_12px_50px_rgba(0,0,0,0.5)] backdrop-blur-xl">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div>
          <p className="text-[11px] tracking-wide text-emerald-200">全國公有停車場</p>
          <p className="text-[11px] text-zinc-500">
            {eventOriginLabel(origin)} · {fetchedAt ? formatUpdatedAt(fetchedAt) : "未提供"}
          </p>
          <p className="mt-1 text-[10px] text-zinc-500">
            綠＝無收費 · 黃＝收費 · 藍邊＝有註冊
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
          className="flex size-11 items-center justify-center rounded-lg text-zinc-400 hover:bg-white/10 touch-manipulation"
        >
          <X className="size-4" />
        </button>
      </div>
      <div className="mb-2 flex flex-wrap gap-1.5">
        {([
          ["all", "全部"],
          ["registered", "有註冊"],
          ["paid", "收費"],
          ["free", "無收費"],
        ] as const).map(([value, label]) => (
          <button
            key={value}
            type="button"
            onClick={() => setFilter(value)}
            className={cn(
              "h-9 rounded-full px-3 text-xs touch-manipulation",
              filter === value ? "bg-sky-400 text-[#041016]" : "bg-white/8 text-zinc-300",
            )}
          >
            {label}
          </button>
        ))}
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
          <div className="mt-1.5 flex flex-wrap gap-1">
            {detail.publicLot ? <Badge>公有</Badge> : null}
            <Badge tone={detail.registered ? "sky" : "zinc"}>
              {detail.registered ? "有註冊" : "未註冊"}
            </Badge>
            <Badge tone={detail.feeClass === "free" ? "green" : detail.feeClass === "paid" ? "amber" : "zinc"}>
              {PARKING_FEE_LABEL[detail.feeClass]}
            </Badge>
          </div>
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
            <Info label="收費" value={detail.fee?.trim() ? detail.fee : PARKING_FEE_LABEL[detail.feeClass]} />
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
          {origin === "unavailable"
            ? "資料暫時無法取得"
            : filter === "all"
              ? "附近沒有公有停車場資料"
              : "這個分類附近沒有符合的公有停車場"}
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
                  className="flex size-9 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold text-[#041016]"
                  style={{
                    backgroundColor: parkingFeeLayerColor(lot.feeClass),
                    boxShadow: lot.registered ? "0 0 0 2px #38bdf8" : undefined,
                  }}
                >
                  {lot.feeClass === "free" ? "免" : lot.feeClass === "paid" ? "收" : "P"}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm">{lot.name}</span>
                  <span className="block truncate text-[11px] text-zinc-500">
                    {PARKING_FEE_LABEL[lot.feeClass]}
                    {lot.registered ? " · 有註冊" : ""}
                    {" · "}
                    {lot.distanceMeters != null ? formatDistance(lot.distanceMeters) : "未提供"}
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

function Badge({
  children,
  tone = "emerald",
}: {
  children: string;
  tone?: "emerald" | "sky" | "green" | "amber" | "zinc";
}) {
  const toneClass =
    tone === "sky"
      ? "bg-sky-400/20 text-sky-100"
      : tone === "green"
        ? "bg-emerald-400/20 text-emerald-100"
        : tone === "amber"
          ? "bg-amber-400/20 text-amber-100"
          : tone === "zinc"
            ? "bg-white/10 text-zinc-300"
            : "bg-emerald-400/20 text-emerald-100";
  return (
    <span className={cn("rounded-full px-2 py-0.5 text-[10px]", toneClass)}>
      {children}
    </span>
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
