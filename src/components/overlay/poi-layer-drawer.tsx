"use client";

import {
  POI_LAYER_COLORS,
  POI_MAIN_LAYERS,
  type PoiLayerVisibility,
  type PoiMainLayerId,
} from "@/lib/poi/main-layers";
import { cn } from "@/lib/utils";

export function PoiLayerDrawer({
  open,
  visibility,
  onToggle,
}: {
  open: boolean;
  visibility: PoiLayerVisibility;
  onToggle: (id: PoiMainLayerId) => void;
}) {
  return (
    <aside
      id="navpilot-poi-layers"
      aria-hidden={!open}
      className={cn(
        "poi-layer-drawer pointer-events-auto rounded-2xl border border-white/15 bg-black/72 px-2 py-2 shadow-[0_12px_32px_rgba(0,0,0,0.45)] backdrop-blur-xl",
        !open && "poi-layer-drawer--closed",
      )}
    >
      <p className="mb-1.5 px-1 text-[11px] tracking-wide text-zinc-300">生活圖層</p>
      <div className="flex flex-col gap-1">
        {POI_MAIN_LAYERS.map((layer) => {
          const on = visibility[layer.id];
          return (
            <button
              key={layer.id}
              type="button"
              aria-pressed={on}
              aria-label={`${layer.label}圖層 ${on ? "顯示" : "隱藏"}`}
              onClick={() => onToggle(layer.id)}
              className={cn(
                "flex h-10 w-full items-center gap-2 rounded-xl px-2 text-left text-sm font-semibold touch-manipulation",
                on ? "bg-white/16 text-white" : "bg-white/6 text-zinc-300",
              )}
            >
              <span
                className="size-3 shrink-0 rounded-full border border-white/70"
                style={{ background: POI_LAYER_COLORS[layer.id] }}
                aria-hidden
              />
              {layer.label === "醫療／生活" ? "醫" : layer.label}
              <span className="ml-auto text-[10px] font-medium text-zinc-400">
                {on ? "開" : "關"}
              </span>
            </button>
          );
        })}
      </div>
    </aside>
  );
}
