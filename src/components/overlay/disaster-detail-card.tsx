"use client";

import { AlertTriangle, X } from "lucide-react";
import type { DisasterAlert, DisasterDataOrigin } from "@/types/domain";

export function DisasterDetailCard({ alert, origin, onClose }: { alert: DisasterAlert; origin: DisasterDataOrigin; onClose: () => void }) {
  return (
    <article className="pointer-events-auto w-fit max-w-[20rem] rounded-2xl border border-orange-300/25 bg-black/75 p-3 text-white shadow-2xl backdrop-blur-xl">
      <div className="flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-orange-500/20 text-orange-200"><AlertTriangle className="size-5" /></span>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] text-orange-200">{origin === "ncdr-live" ? "NCDR 即時示警" : "示範災害資料"} · {alert.source ?? "災害通報"}</p>
          <h2 className="mt-0.5 font-semibold">{alert.title}</h2>
          <p className="mt-1 line-clamp-3 text-xs leading-5 text-zinc-300">{alert.description}</p>
          {alert.area ? <p className="mt-1 text-xs text-zinc-400">影響區域：{alert.area}</p> : null}
        </div>
        <button type="button" aria-label="關閉災害資訊" onClick={onClose} className="flex size-9 shrink-0 items-center justify-center rounded-lg text-zinc-400 hover:bg-white/10"><X className="size-4" /></button>
      </div>
    </article>
  );
}
