"use client";

import { ChevronDown, Search, ShieldAlert, Users } from "lucide-react";
import { useMemo, useState } from "react";
import type { VolunteerMapPoint } from "@/types/domain";

type VolunteerLayerPanelProps = {
  enabled: boolean;
  volunteers: VolunteerMapPoint[];
  selectedId: string | null;
  district: string;
  onDistrictChange: (district: string) => void;
  onEnabledChange: (enabled: boolean) => void;
  onSelect: (volunteer: VolunteerMapPoint) => void;
};

const STATUS_LABEL = {
  unassigned: "未分派",
  assigned: "已分派",
  completed: "已完成",
} as const;

export function VolunteerLayerPanel({
  enabled,
  volunteers,
  selectedId,
  district,
  onDistrictChange,
  onEnabledChange,
  onSelect,
}: VolunteerLayerPanelProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const districts = useMemo(
    () => ["全部行政區", ...Array.from(new Set(volunteers.map((item) => item.district)))],
    [volunteers],
  );
  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return volunteers.filter((item) => {
      if (district !== "全部行政區" && item.district !== district) return false;
      if (!normalized) return true;
      return `${item.displayName} ${item.addressLabel} ${item.assignedGroup}`
        .toLowerCase()
        .includes(normalized);
    });
  }, [district, query, volunteers]);

  return (
    <section className="w-[min(22rem,calc(100vw-5.5rem))] rounded-2xl border border-cyan-300/25 bg-[#071017]/92 text-zinc-100 shadow-2xl backdrop-blur-xl">
      <button
        type="button"
        className="flex w-full items-center gap-3 px-3 py-2.5 text-left"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
      >
        <span className="grid size-9 place-items-center rounded-xl bg-cyan-300/12 text-cyan-200">
          <Users className="size-5" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold">志工服務點</span>
          <span className="block truncate text-[11px] text-cyan-100/70">
            UI Shell · 合成示意資料
          </span>
        </span>
        <label className="flex items-center gap-2 text-xs" onClick={(event) => event.stopPropagation()}>
          <input
            type="checkbox"
            checked={enabled}
            onChange={(event) => onEnabledChange(event.target.checked)}
            className="size-4 accent-cyan-300"
            aria-label="切換志工服務點圖層"
          />
          顯示
        </label>
        <ChevronDown className={`size-4 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open ? (
        <div className="border-t border-white/10 p-3">
          <div className="mb-3 flex gap-2 rounded-xl border border-amber-300/25 bg-amber-300/8 p-2 text-[11px] leading-4 text-amber-100">
            <ShieldAlert className="mt-0.5 size-4 shrink-0" />
            <p>目前僅顯示合成資料與行政區示意點；非住宅精確位置，未連接真實志工資料。</p>
          </div>
          <div className="grid grid-cols-[1fr_auto] gap-2">
            <label className="relative">
              <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-zinc-500" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="搜尋示範姓名或分組"
                className="h-9 w-full rounded-xl border border-white/10 bg-black/35 pr-2 pl-8 text-xs outline-none focus:border-cyan-300/50"
              />
            </label>
            <select
              value={district}
              onChange={(event) => onDistrictChange(event.target.value)}
              className="h-9 rounded-xl border border-white/10 bg-[#0a131b] px-2 text-xs"
              aria-label="行政區篩選"
            >
              {districts.map((item) => (
                <option key={item}>{item}</option>
              ))}
            </select>
          </div>
          <div className="mt-2 flex items-center justify-between text-[11px] text-zinc-400">
            <span>{filtered.length} 個示意點</span>
            <span>永康區優先</span>
          </div>
          <div className="volunteer-list mt-2 max-h-52 space-y-1 overflow-y-auto pr-1">
            {filtered.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelect(item)}
                className={`flex w-full items-center gap-2 rounded-xl border px-2.5 py-2 text-left transition ${
                  selectedId === item.id
                    ? "border-cyan-300/50 bg-cyan-300/12"
                    : "border-transparent bg-white/[0.035] hover:border-white/10 hover:bg-white/[0.07]"
                }`}
              >
                <span className="grid size-8 shrink-0 place-items-center rounded-full border border-dashed border-cyan-200/60 bg-cyan-300/10 text-sm">👤</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-xs font-medium">{item.displayName}</span>
                  <span className="block truncate text-[10px] text-zinc-400">{item.district} · {item.assignedGroup}</span>
                </span>
                <span className="rounded-full bg-white/8 px-2 py-1 text-[9px] text-zinc-300">
                  {STATUS_LABEL[item.assignmentStatus]}
                </span>
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}
