"use client";

import { useState } from "react";
import { Phone } from "lucide-react";
import { poiCategoryLabel } from "@/lib/poi/category-label";
import { POI_LAYER_COLORS, POI_MAIN_LAYERS, type PoiMainLayerId } from "@/lib/poi/main-layers";
import { formatDistance } from "@/lib/format";
import { formatTaiwanDisplayAddress, formatTaiwanRoadName } from "@/lib/geocoding/format-taiwan-display-address";
import { distanceKm } from "@/lib/geo";
import { poiFeatureToPlace } from "@/lib/map-place";
import { useYellowPagesNearby } from "@/hooks/use-yellow-pages-nearby";
import { cn } from "@/lib/utils";
import type { GeocodeHit, LngLat } from "@/types/domain";

export function YellowPagesSearchStrip({
  origin,
  onSelect,
}: {
  origin: LngLat | null;
  onSelect: (hit: GeocodeHit) => void;
}) {
  const [layer, setLayer] = useState<PoiMainLayerId | null>(null);
  const { pois, loading, error } = useYellowPagesNearby({ origin, layer });
  const selected = POI_MAIN_LAYERS.find((item) => item.id === layer) ?? null;

  return (
    <div className="mb-1.5">
      <div className="flex gap-1 overflow-x-auto pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {POI_MAIN_LAYERS.map((item) => {
          const on = layer === item.id;
          return (
            <button
              key={item.id}
              type="button"
              aria-pressed={on}
              aria-label={`${item.yp}附近店家`}
              onClick={() => setLayer((current) => (current === item.id ? null : item.id))}
              className={cn(
                "flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold touch-manipulation",
                on ? "text-[#042f2e]" : "bg-black/55 text-zinc-100",
              )}
              style={
                on
                  ? { background: POI_LAYER_COLORS[item.id] }
                  : { border: "1px solid rgba(255,255,255,0.14)" }
              }
            >
              <span>{item.short}</span>
              <span className={on ? "opacity-90" : "text-zinc-400"}>{item.yp}</span>
            </button>
          );
        })}
      </div>
      {layer ? (
        <div className="mt-1 max-h-44 overflow-y-auto rounded-2xl border border-white/12 bg-black/72 px-2 py-1.5 shadow-[0_10px_28px_rgba(0,0,0,0.4)] backdrop-blur-xl">
          <p className="px-1 pb-1 text-[10px] tracking-wide text-zinc-400">
            {selected ? `${selected.yp} · 附近店家` : "附近店家"}
          </p>
          {loading ? (
            <p className="px-1 py-2 text-sm text-zinc-300">讀取中…</p>
          ) : error ? (
            <p className="px-1 py-2 text-sm text-amber-200">{error}</p>
          ) : pois.length === 0 ? (
            <p className="px-1 py-2 text-sm text-zinc-300">
              {origin ? "附近暫無此分類店家" : "開啟定位後即可列出附近店家"}
            </p>
          ) : (
            <ul>
              {pois.map((poi) => {
                const meters = origin
                  ? Math.round(distanceKm(origin, poi.location) * 1000)
                  : undefined;
                const phone = poi.phone?.trim() || "";
                return (
                  <li key={poi.id}>
                    <button
                      type="button"
                      onClick={() => {
                        const place = poiFeatureToPlace(poi, origin);
                        onSelect({
                          id: place.id,
                          name: place.name,
                          address: place.address,
                          location: place.location,
                          source: "index",
                          matchKind: "landmark",
                          distanceMeters: place.distanceMeters,
                          category: place.category,
                          phone: place.phone,
                          branchName: poi.branchName || undefined,
                        });
                      }}
                      className="flex w-full min-w-0 items-start gap-2 rounded-xl px-1 py-1.5 text-left hover:bg-white/8 touch-manipulation"
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold text-white">
                          {formatTaiwanDisplayAddress(poi.name)}
                        </span>
                        <span className="block truncate text-[11px] text-zinc-400">
                          {formatTaiwanRoadName(poi.address) || "地址未提供"}
                        </span>
                        <span className="mt-0.5 flex items-center gap-1 text-[11px] text-cyan-100/90">
                          <Phone className="size-3 shrink-0" />
                          {phone || "未提供"}
                          <span className="text-zinc-500">
                            · {poiCategoryLabel(poi.category)}
                            {meters != null ? ` · ${formatDistance(meters)}` : ""}
                          </span>
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}
