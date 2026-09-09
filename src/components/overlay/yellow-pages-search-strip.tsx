"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { formatDistance } from "@/lib/format";
import { formatDistanceRoadLabel } from "@/lib/geocoding/format-taiwan-display-address";
import { poiFeatureToPlace } from "@/lib/map-place";
import type { ConvenienceKind } from "@/lib/poi/convenience-kind";
import type { EnergyKind } from "@/lib/poi/energy-kind";
import { formatLayerPoiTitle } from "@/lib/poi/display";
import {
  CONVENIENCE_BRAND_SHORTCUTS,
  FUEL_ENERGY_SHORTCUTS,
  SEARCH_SHORTCUTS,
  type SearchShortcutId,
} from "@/lib/search-shortcuts";
import { useYellowPagesNearby } from "@/hooks/use-yellow-pages-nearby";
import { cn } from "@/lib/utils";
import type { GeocodeHit, LngLat } from "@/types/domain";

function emptyCopy(
  shortcut: SearchShortcutId | null,
  energyKind: EnergyKind | null,
  convenienceKind: ConvenienceKind | null,
) {
  if (shortcut === "fuel" && energyKind === "gogoro") return "附近暫無 Gogoro 充電站";
  if (shortcut === "fuel" && energyKind === "tesla") return "附近暫無 Tesla 超充站";
  if (shortcut === "fuel" && energyKind === "ev") return "附近暫無電車充電站";
  if (shortcut === "fuel") return "附近暫無加油站";
  if (shortcut === "convenience" && convenienceKind === "seven") return "附近暫無統一超商";
  if (shortcut === "convenience" && convenienceKind === "familymart") return "附近暫無全家";
  if (shortcut === "convenience" && convenienceKind === "hilife") return "附近暫無萊爾富";
  if (shortcut === "convenience" && convenienceKind === "okmart") return "附近暫無 OK Mart";
  if (shortcut === "convenience" && convenienceKind === "shopee") return "附近暫無蝦皮店到店";
  if (shortcut === "convenience") return "附近暫無超商";
  return "附近暫無此分類店家";
}

function previewHeading(
  shortcut: SearchShortcutId | null,
  energyKind: EnergyKind | null,
  convenienceKind: ConvenienceKind | null,
) {
  if (shortcut === "fuel" && energyKind === "gogoro") return "Gogoro 充電站";
  if (shortcut === "fuel" && energyKind === "tesla") return "Tesla 超充站";
  if (shortcut === "fuel" && energyKind === "ev") return "電車充電站";
  if (shortcut === "fuel") return "加油站";
  if (shortcut === "convenience" && convenienceKind === "seven") return "統一";
  if (shortcut === "convenience" && convenienceKind === "familymart") return "全家";
  if (shortcut === "convenience" && convenienceKind === "hilife") return "萊爾富";
  if (shortcut === "convenience" && convenienceKind === "okmart") return "OK Mart";
  if (shortcut === "convenience" && convenienceKind === "shopee") return "蝦皮店到店";
  if (shortcut === "convenience") return "超商";
  const selected = SEARCH_SHORTCUTS.find((item) => item.id === shortcut);
  return selected?.label ?? "附近店家";
}

function SlideDownDrawer({
  id,
  open,
  columns,
  children,
}: {
  id: string;
  open: boolean;
  columns: 3 | 5;
  children: ReactNode;
}) {
  return (
    <div
      id={id}
      className={cn(
        "grid transition-[grid-template-rows] duration-[400ms] ease-out motion-reduce:transition-none",
        open ? "grid-rows-[1fr]" : "pointer-events-none grid-rows-[0fr]",
      )}
      aria-hidden={!open}
    >
      <div className="min-h-0 overflow-hidden">
        <div
          className={cn(
            "mt-1 grid gap-1 transition-transform duration-[400ms] ease-out motion-reduce:transition-none",
            columns === 5 ? "grid-cols-3 sm:grid-cols-5" : "grid-cols-3",
            open ? "translate-y-0" : "-translate-y-full",
          )}
        >
          {children}
        </div>
      </div>
    </div>
  );
}

export function YellowPagesSearchStrip({
  origin,
  onSelect,
}: {
  origin: LngLat | null;
  onSelect: (hit: GeocodeHit) => void;
}) {
  const [shortcut, setShortcut] = useState<SearchShortcutId | null>(null);
  const [energyKind, setEnergyKind] = useState<EnergyKind | null>(null);
  const [convenienceKind, setConvenienceKind] = useState<ConvenienceKind | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const fuelOpen = shortcut === "fuel";
  const convenienceOpen = shortcut === "convenience";
  const resolvedEnergy = fuelOpen ? (energyKind ?? "petrol") : null;
  const resolvedConvenience = convenienceOpen ? (convenienceKind ?? "all") : null;
  const { pois, loading, error } = useYellowPagesNearby({
    origin,
    shortcut,
    energyKind: resolvedEnergy,
    convenienceKind: resolvedConvenience,
  });

  useEffect(() => {
    if (!shortcut) return;
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (!target) return;
      if (rootRef.current?.contains(target)) return;
      setShortcut(null);
      setEnergyKind(null);
      setConvenienceKind(null);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [shortcut]);

  return (
    <div ref={rootRef} className="mb-1.5">
      <div className="grid grid-cols-4 gap-1">
        {SEARCH_SHORTCUTS.map((item) => {
          const on = shortcut === item.id;
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              type="button"
              aria-pressed={on}
              aria-expanded={
                item.id === "fuel"
                  ? fuelOpen
                  : item.id === "convenience"
                    ? convenienceOpen
                    : on
              }
              aria-controls={
                item.id === "fuel"
                  ? "navpilot-fuel-energy-drawer"
                  : item.id === "convenience"
                    ? "navpilot-convenience-brand-drawer"
                    : on
                      ? "navpilot-shortcut-preview"
                      : undefined
              }
              aria-label={
                item.id === "fuel"
                  ? "加油站，點入後展開 Gogoro、Tesla 超充與電車充電站"
                  : item.id === "convenience"
                    ? "超商，點入後展開統一、全家、萊爾富、OK Mart 與蝦皮店到店"
                    : `${item.label}附近`
              }
              title={item.hint}
              onClick={() => {
                if (item.id === "fuel") {
                  if (fuelOpen) {
                    setShortcut(null);
                    setEnergyKind(null);
                    setConvenienceKind(null);
                    return;
                  }
                  setShortcut("fuel");
                  setEnergyKind("petrol");
                  setConvenienceKind(null);
                  return;
                }
                if (item.id === "convenience") {
                  if (convenienceOpen) {
                    setShortcut(null);
                    setEnergyKind(null);
                    setConvenienceKind(null);
                    return;
                  }
                  setShortcut("convenience");
                  setConvenienceKind("all");
                  setEnergyKind(null);
                  return;
                }
                setEnergyKind(null);
                setConvenienceKind(null);
                setShortcut((current) => (current === item.id ? null : item.id));
              }}
              className={cn(
                "flex min-w-0 flex-col items-center gap-0.5 rounded-xl px-1 py-1.5 text-center touch-manipulation",
                on ? "text-[#042f2e]" : "bg-black/55 text-zinc-100",
              )}
              style={
                on
                  ? { background: item.color }
                  : { border: "1px solid rgba(255,255,255,0.14)" }
              }
            >
              <Icon className="size-5 shrink-0" strokeWidth={2.2} aria-hidden />
              <span className="max-w-full truncate text-[10px] font-semibold leading-tight sm:text-[11px]">
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
      <SlideDownDrawer id="navpilot-fuel-energy-drawer" open={fuelOpen} columns={3}>
        {FUEL_ENERGY_SHORTCUTS.map((item) => {
          const on = energyKind === item.id;
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              type="button"
              tabIndex={fuelOpen ? 0 : -1}
              aria-pressed={on}
              aria-label={`${item.label}附近`}
              title={item.hint}
              onClick={() =>
                setEnergyKind((current) => (current === item.id ? "petrol" : item.id))
              }
              className={cn(
                "flex min-w-0 flex-col items-center justify-center gap-0.5 rounded-xl px-1 py-1.5 text-center touch-manipulation",
                on ? "text-white" : "bg-black/55 text-zinc-100",
              )}
              style={
                on
                  ? { background: item.color }
                  : { border: "1px solid rgba(255,255,255,0.14)" }
              }
            >
              <Icon className="size-4 shrink-0" strokeWidth={2.2} aria-hidden />
              <span className="max-w-full truncate text-[9px] font-semibold leading-tight sm:text-[10px]">
                {item.label}
              </span>
            </button>
          );
        })}
      </SlideDownDrawer>
      <SlideDownDrawer
        id="navpilot-convenience-brand-drawer"
        open={convenienceOpen}
        columns={5}
      >
        {CONVENIENCE_BRAND_SHORTCUTS.map((item) => {
          const on = convenienceKind === item.id;
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              type="button"
              tabIndex={convenienceOpen ? 0 : -1}
              aria-pressed={on}
              aria-label={`${item.label}附近`}
              title={item.hint}
              onClick={() =>
                setConvenienceKind((current) => (current === item.id ? "all" : item.id))
              }
              className={cn(
                "flex min-w-0 flex-col items-center justify-center gap-0.5 rounded-xl px-1 py-1.5 text-center touch-manipulation",
                on ? "text-white" : "bg-black/55 text-zinc-100",
              )}
              style={
                on
                  ? { background: item.color }
                  : { border: "1px solid rgba(255,255,255,0.14)" }
              }
            >
              <Icon className="size-4 shrink-0" strokeWidth={2.2} aria-hidden />
              <span className="max-w-full truncate text-[9px] font-semibold leading-tight sm:text-[10px]">
                {item.label}
              </span>
            </button>
          );
        })}
      </SlideDownDrawer>
      {shortcut ? (
        <div
          id="navpilot-shortcut-preview"
          className="mt-1 max-h-44 overflow-y-auto rounded-2xl border border-white/12 bg-black/72 px-2 py-1.5 shadow-[0_10px_28px_rgba(0,0,0,0.4)] backdrop-blur-xl"
        >
          <p className="px-1 pb-1 text-[10px] tracking-wide text-zinc-400">
            {previewHeading(shortcut, resolvedEnergy, resolvedConvenience)}
          </p>
          {loading && pois.length === 0 ? (
            <p className="px-1 py-2 text-sm text-zinc-300">讀取中…</p>
          ) : error && pois.length === 0 ? (
            <p className="px-1 py-2 text-sm text-amber-200">{error}</p>
          ) : pois.length === 0 ? (
            <p className="px-1 py-2 text-sm text-zinc-300">
              {origin
                ? emptyCopy(shortcut, resolvedEnergy, resolvedConvenience)
                : "開啟定位後即可列出附近店家"}
            </p>
          ) : (
            <ul>
              {pois.map((poi) => {
                const title = formatLayerPoiTitle(poi);
                const street = formatDistanceRoadLabel(poi.address);
                const distance = formatDistance(poi.distanceMeters);
                return (
                  <li key={poi.id}>
                    <button
                      type="button"
                      onClick={() => {
                        const place = poiFeatureToPlace(poi, origin);
                        onSelect({
                          id: place.id,
                          name: title,
                          address: place.address,
                          location: place.location,
                          source: "index",
                          matchKind: "landmark",
                          distanceMeters: poi.distanceMeters,
                          category: place.category,
                          phone: place.phone,
                          branchName: poi.branchName || undefined,
                        });
                      }}
                      className="flex w-full min-w-0 items-start gap-2 rounded-xl px-1 py-1.5 text-left hover:bg-white/8 touch-manipulation"
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold text-white">
                          {title}
                        </span>
                        <span className="mt-0.5 flex min-w-0 items-baseline gap-1.5 leading-snug text-zinc-200">
                          <span className="shrink-0 text-[15px] font-semibold tabular-nums text-sky-400">
                            {distance}
                          </span>
                          {street ? (
                            <>
                              <span className="shrink-0 text-zinc-500" aria-hidden>
                                ·
                              </span>
                              <span className="min-w-0 truncate text-[12px]">{street}</span>
                            </>
                          ) : null}
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
