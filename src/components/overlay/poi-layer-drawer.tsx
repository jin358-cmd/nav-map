"use client";

import {
  POI_LAYER_COLORS,
  POI_MAIN_LAYERS,
  type PoiLayerVisibility,
  type PoiMainLayerId,
} from "@/lib/poi/main-layers";
import { PoiLayerReadBanner } from "@/components/overlay/poi-layer-read-progress";
import { cn } from "@/lib/utils";

export function PoiLayerDrawer({
  open,
  visibility,
  loading = false,
  progress = 0,
  onToggle,
}: {
  open: boolean;
  visibility: PoiLayerVisibility;
  loading?: boolean;
  progress?: number;
  onToggle: (id: PoiMainLayerId) => void;
}) {
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
      <p className="mb-1.5 px-1 text-[11px] tracking-wide text-zinc-300">生活圖層</p>
      {loading ? <PoiLayerReadBanner progress={progress} /> : null}
      <div className="flex flex-col gap-1">
        {POI_MAIN_LAYERS.map((layer) => {
          const on = visibility[layer.id];
          return (
            <button
              key={layer.id}
              type="button"
              role="switch"
              aria-checked={on}
              aria-label={`${layer.label}圖層 ${on ? "開" : "關"}`}
              onClick={() => onToggle(layer.id)}
              className={cn(
                "flex min-h-10 w-full items-center gap-2 rounded-xl px-2 py-1 text-left touch-manipulation",
                on ? "bg-white/16 text-white" : "bg-white/6 text-zinc-300",
              )}
            >
              <span
                className="size-3 shrink-0 rounded-full border border-white/70"
                style={{ background: POI_LAYER_COLORS[layer.id] }}
                aria-hidden
              />
              <span className="min-w-0 flex-1 text-sm font-semibold leading-tight">
                {layer.short}
              </span>
              <span
                className={cn(
                  "relative inline-flex h-4 w-8 shrink-0 items-center rounded-full px-0.5",
                  on ? "bg-emerald-500" : "bg-red-500",
                )}
                aria-hidden
              >
                <span
                  className={cn(
                    "size-3 rounded-full bg-white shadow transition-transform",
                    on ? "translate-x-3.5" : "translate-x-0",
                  )}
                />
              </span>
            </button>
          );
        })}
      </div>
    </aside>
  );
}
