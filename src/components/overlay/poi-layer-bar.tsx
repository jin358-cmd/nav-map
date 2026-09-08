"use client";

import { POI_MAIN_LAYERS, type PoiLayerVisibility, type PoiMainLayerId } from "@/lib/poi/main-layers";
import { cn } from "@/lib/utils";

export function PoiLayerBar({
  visibility,
  onToggle,
}: {
  visibility: PoiLayerVisibility;
  onToggle: (id: PoiMainLayerId) => void;
}) {
  return (
    <div
      id="navpilot-poi-layers"
      className="pointer-events-auto hud-float-panel mb-1.5 flex max-w-xl flex-wrap justify-end gap-1 rounded-2xl px-1.5 py-1.5"
    >
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
              "h-9 min-w-9 rounded-full px-2.5 text-[11px] font-semibold touch-manipulation",
              on
                ? "bg-cyan-300/90 text-[#042f2e]"
                : "bg-white/10 text-zinc-300",
            )}
          >
            {layer.short}
          </button>
        );
      })}
    </div>
  );
}
