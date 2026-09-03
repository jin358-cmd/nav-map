"use client";

import { X } from "lucide-react";
import { formatDistance } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { RoadIntelItem, RoadIntelKind } from "@/types/domain";

const KIND_LABEL: Record<RoadIntelKind, string> = {
  congestion: "交通壅塞",
  cctv: "CCTV",
  construction: "道路施工",
  accident: "交通事故",
  disaster: "災害警報",
};

export function EventListPanel({
  kind,
  items,
  emptyHint,
  onSelect,
  onClose,
}: {
  kind: RoadIntelKind;
  items: RoadIntelItem[];
  emptyHint?: string;
  onSelect: (item: RoadIntelItem) => void;
  onClose: () => void;
}) {
  return (
    <section className="pointer-events-auto w-full max-w-xl rounded-2xl border border-white/12 bg-black/78 p-2.5 text-white shadow-[0_12px_40px_rgba(0,0,0,0.5)] backdrop-blur-xl">
      <div className="mb-1 flex items-center justify-between gap-2">
        <p className="text-[11px] tracking-wide text-zinc-400">
          {KIND_LABEL[kind]} · 依距離排序
        </p>
        <button
          type="button"
          aria-label="關閉事件列表"
          onClick={onClose}
          className="flex size-11 shrink-0 items-center justify-center rounded-lg text-zinc-400 hover:bg-white/10 hover:text-white touch-manipulation"
        >
          <X className="size-4" />
        </button>
      </div>
      {items.length === 0 ? (
        <p className="px-2 py-3 text-sm text-zinc-300">
          {emptyHint ?? "資料暫時無法取得"}
        </p>
      ) : (
        <ul className="max-h-48 overflow-y-auto">
          {items.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                onClick={() => onSelect(item)}
                className={cn(
                  "flex w-full items-start gap-2 rounded-xl px-2 py-2 text-left hover:bg-white/8 touch-manipulation",
                )}
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm">{item.title}</span>
                  <span className="block truncate text-[11px] text-zinc-500">
                    {item.detail}
                  </span>
                </span>
                <span className="shrink-0 text-[11px] text-zinc-400">
                  {formatDistance(item.distanceMeters)}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
