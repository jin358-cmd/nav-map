"use client";

import { useState } from "react";
import { Check, ChevronLeft, ChevronRight } from "lucide-react";
import {
  LIFE_CIRCLE_LAYER_LABEL,
  POI_LAYER_COLORS,
  POI_MAIN_LAYERS,
  type PoiLayerVisibility,
  type PoiMainLayerId,
} from "@/lib/poi/main-layers";
import {
  POI_SUBCATEGORIES,
  poiSubSelectionCount,
  type PoiSubVisibility,
} from "@/lib/poi/subcategories";
import { PoiLayerReadBanner } from "@/components/overlay/poi-layer-read-progress";
import { cn } from "@/lib/utils";

export function PoiLayerDrawer({
  open,
  visibility,
  subVisibility,
  loading = false,
  progress = 0,
  loadingLabel = LIFE_CIRCLE_LAYER_LABEL,
  onToggle,
  onToggleSub,
  onSetAllSubs,
}: {
  open: boolean;
  visibility: PoiLayerVisibility;
  subVisibility: PoiSubVisibility;
  loading?: boolean;
  progress?: number;
  loadingLabel?: string;
  onToggle: (id: PoiMainLayerId) => void;
  onToggleSub: (id: PoiMainLayerId, subId: string) => void;
  onSetAllSubs: (id: PoiMainLayerId, on: boolean) => void;
}) {
  const [drillLayer, setDrillLayer] = useState<PoiMainLayerId | null>(null);
  const drilled = POI_MAIN_LAYERS.find((layer) => layer.id === drillLayer);
  const drilledCount = drilled
    ? poiSubSelectionCount(drilled.id, subVisibility)
    : null;

  return (
    <aside
      id="navpilot-poi-layers"
      aria-hidden={!open}
      className={cn(
        "poi-layer-drawer pointer-events-auto rounded-2xl border border-white/15 bg-black/80 px-2 py-2 shadow-[0_12px_32px_rgba(0,0,0,0.45)] backdrop-blur-xl",
        !open && "poi-layer-drawer--closed",
      )}
      aria-busy={loading || undefined}
    >
      {drilled ? (
        <div className="mb-1.5 flex items-center gap-1">
          <button
            type="button"
            onClick={() => setDrillLayer(null)}
            className="inline-flex size-8 shrink-0 items-center justify-center rounded-lg text-zinc-200 touch-manipulation hover:bg-white/10"
            aria-label="返回生活圈圖層"
          >
            <ChevronLeft className="size-4" strokeWidth={2.5} />
          </button>
          <p className="min-w-0 flex-1 text-[11px] tracking-wide text-zinc-300">
            {drilled.short} · {drilled.yp}
          </p>
        </div>
      ) : (
        <div className="mb-1.5 px-1">
          <p className="text-[11px] tracking-wide text-zinc-300">
            {LIFE_CIRCLE_LAYER_LABEL}
          </p>
          <p className="text-[10px] leading-tight text-zinc-500">
            點各大類可選小分類
          </p>
        </div>
      )}
      {loading ? <PoiLayerReadBanner progress={progress} label={loadingLabel} /> : null}
      {drilled ? (
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-1 px-0.5">
            <button
              type="button"
              onClick={() => onSetAllSubs(drilled.id, true)}
              className="rounded-lg bg-white/10 px-2 py-1 text-[11px] font-medium text-zinc-100 touch-manipulation hover:bg-white/16"
            >
              全選
            </button>
            <button
              type="button"
              onClick={() => onSetAllSubs(drilled.id, false)}
              className="rounded-lg bg-white/10 px-2 py-1 text-[11px] font-medium text-zinc-100 touch-manipulation hover:bg-white/16"
            >
              清除
            </button>
            <span className="ml-auto pr-1 text-[10px] text-zinc-400">
              {drilledCount
                ? `${drilledCount.selected}/${drilledCount.total}`
                : null}
            </span>
          </div>
          <div className="poi-layer-drawer__list flex flex-col gap-1">
            {POI_SUBCATEGORIES[drilled.id].map((sub) => {
              const on = Boolean(subVisibility[drilled.id]?.[sub.id]);
              return (
                <button
                  key={sub.id}
                  type="button"
                  role="checkbox"
                  aria-checked={on}
                  aria-label={`${sub.label} ${on ? "已選" : "未選"}`}
                  onClick={() => onToggleSub(drilled.id, sub.id)}
                  className={cn(
                    "flex min-h-10 w-full items-center gap-2 rounded-xl px-2 py-1.5 text-left touch-manipulation",
                    on ? "bg-white/16 text-white" : "bg-white/6 text-zinc-300",
                  )}
                >
                  <span
                    className={cn(
                      "inline-flex size-4 shrink-0 items-center justify-center rounded border",
                      on
                        ? "border-emerald-300 bg-emerald-500 text-white"
                        : "border-white/35 bg-transparent",
                    )}
                    aria-hidden
                  >
                    {on ? <Check className="size-3" strokeWidth={3} /> : null}
                  </span>
                  <span className="min-w-0 flex-1 text-sm font-medium leading-tight">
                    {sub.label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="poi-layer-drawer__list flex flex-col gap-1">
          {POI_MAIN_LAYERS.map((layer) => {
            const on = visibility[layer.id];
            const { selected, total } = poiSubSelectionCount(layer.id, subVisibility);
            return (
              <div
                key={layer.id}
                className={cn(
                  "flex min-h-11 w-full items-center gap-1 rounded-xl px-1 py-1",
                  on ? "bg-white/16 text-white" : "bg-white/6 text-zinc-300",
                )}
              >
                <button
                  type="button"
                  onClick={() => setDrillLayer(layer.id)}
                  className="flex min-w-0 flex-1 items-center gap-2 rounded-lg px-1 py-1 text-left touch-manipulation"
                  aria-label={`${layer.short} ${layer.yp}，點入選擇小分類`}
                >
                  <span
                    className="size-3 shrink-0 rounded-full border border-white/70"
                    style={{ background: POI_LAYER_COLORS[layer.id] }}
                    aria-hidden
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold leading-tight">
                      {layer.short}
                    </span>
                    <span
                      className={cn(
                        "block text-[11px] font-medium leading-tight",
                        on ? "text-zinc-200" : "text-zinc-400",
                      )}
                    >
                      {layer.yp}
                    </span>
                    <span className="block text-[10px] leading-tight text-zinc-500">
                      {selected}/{total} 小分類
                    </span>
                  </span>
                  <ChevronRight className="size-4 shrink-0 text-zinc-400" strokeWidth={2.25} />
                </button>
                <button
                  type="button"
                  role="switch"
                  aria-checked={on}
                  aria-label={`${layer.short} ${layer.yp}圖層 ${on ? "開" : "關"}`}
                  onClick={() => onToggle(layer.id)}
                  className={cn(
                    "relative mr-1 inline-flex h-4 w-8 shrink-0 items-center rounded-full px-0.5 touch-manipulation",
                    on ? "bg-emerald-500" : "bg-red-500",
                  )}
                >
                  <span
                    className={cn(
                      "size-3 rounded-full bg-white shadow transition-transform",
                      on ? "translate-x-3.5" : "translate-x-0",
                    )}
                  />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </aside>
  );
}
