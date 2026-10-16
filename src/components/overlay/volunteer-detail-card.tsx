"use client";

import { Copy, ShieldAlert, X } from "lucide-react";
import type { VolunteerMapPoint } from "@/types/domain";

type VolunteerDetailCardProps = {
  volunteer: VolunteerMapPoint;
  onClose: () => void;
};

const STATUS_LABEL = {
  unassigned: "未分派",
  assigned: "已分派",
  completed: "已完成",
} as const;

export function VolunteerDetailCard({ volunteer, onClose }: VolunteerDetailCardProps) {
  return (
    <article className="pointer-events-auto w-full max-w-xl rounded-2xl border border-cyan-300/25 bg-[#071017]/94 p-3 shadow-2xl backdrop-blur-xl">
      <div className="flex items-start gap-3">
        <span className="grid size-12 shrink-0 place-items-center rounded-full border border-dashed border-cyan-200/60 bg-cyan-300/12 text-2xl">👤</span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h2 className="truncate text-sm font-semibold">{volunteer.displayName}</h2>
            <span className="rounded-full bg-amber-300/12 px-2 py-0.5 text-[10px] text-amber-100">合成資料</span>
          </div>
          <p className="mt-1 text-xs text-zinc-300">{volunteer.addressLabel}</p>
          <div className="mt-2 grid grid-cols-2 gap-2 text-[11px] text-zinc-400 sm:grid-cols-4">
            <span>行政區<br /><b className="text-zinc-200">{volunteer.district}</b></span>
            <span>定位<br /><b className="text-zinc-200">非精確示意</b></span>
            <span>分組<br /><b className="text-zinc-200">{volunteer.assignedGroup}</b></span>
            <span>狀態<br /><b className="text-zinc-200">{STATUS_LABEL[volunteer.assignmentStatus]}</b></span>
          </div>
          <div className="mt-2 flex items-center gap-2 rounded-xl border border-amber-300/20 bg-amber-300/7 p-2 text-[10px] text-amber-100">
            <ShieldAlert className="size-4 shrink-0" />
            <span>{volunteer.contactLabel}。電話、完整地址與精確住宅點位未進入此 Preview。</span>
          </div>
        </div>
        <button type="button" onClick={onClose} aria-label="關閉志工詳情" className="grid size-8 shrink-0 place-items-center rounded-full bg-white/5 text-zinc-400 hover:bg-white/10 hover:text-white">
          <X className="size-4" />
        </button>
      </div>
      <button
        type="button"
        onClick={() => void navigator.clipboard?.writeText(volunteer.addressLabel)}
        className="mt-2 inline-flex items-center gap-1 rounded-lg border border-white/10 px-2 py-1 text-[10px] text-zinc-300 hover:bg-white/5"
      >
        <Copy className="size-3" /> 複製示意標籤
      </button>
    </article>
  );
}
