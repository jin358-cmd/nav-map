"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2, MapPin, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TAIWAN_LANDMARKS } from "@/data/landmarks";
import { cn } from "@/lib/utils";
import { searchAddresses } from "@/services/routing";
import type { GeocodeHit, LngLat, RouteDestination } from "@/types/domain";

type AddressSearchProps = {
  bias: LngLat;
  destination: RouteDestination | null;
  busy: boolean;
  error: string | null;
  onSelect: (hit: GeocodeHit) => void;
  onClear: () => void;
  onPreviewRoute: () => void;
  onStartNav: () => void;
};

export function AddressSearch({
  bias,
  destination,
  busy,
  error,
  onSelect,
  onClear,
  onPreviewRoute,
  onStartNav,
}: AddressSearchProps) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [hits, setHits] = useState<GeocodeHit[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const needle = query.trim();

  useEffect(() => {
    if (needle.length < 2) return;

    const timer = window.setTimeout(() => {
      setSearching(true);
      void searchAddresses(needle, bias)
        .then((rows) => {
          setHits(rows);
          setSearchError(rows.length ? null : "找不到這個地址，請換個關鍵字。");
        })
        .catch(() => {
          setHits([]);
          setSearchError("地址搜尋失敗，請稍後再試。");
        })
        .finally(() => setSearching(false));
    }, 320);

    return () => window.clearTimeout(timer);
  }, [bias, needle]);

  const visibleHits = needle.length < 2 ? [] : hits;
  const chips = useMemo(() => TAIWAN_LANDMARKS.slice(0, 5), []);
  const emptyHint =
    needle.length >= 2 && !searching && !busy
      ? searchError
      : null;

  return (
    <div className="pointer-events-auto w-full max-w-xl">
      <div className="rounded-2xl border border-white/12 bg-black/60 shadow-[0_10px_40px_rgba(0,0,0,0.45)] backdrop-blur-xl">
        <div className="flex items-center gap-2 px-2.5 py-2">
          <Search className="ml-1 size-4 shrink-0 text-cyan-300" />
          <Input
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            placeholder="輸入地址、路口或地標"
            aria-label="目的地地址"
            className="h-10 border-0 bg-transparent px-1 text-sm text-white shadow-none placeholder:text-zinc-500 focus-visible:ring-0"
          />
          {query || destination ? (
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label="清除"
              onClick={() => {
                setQuery("");
                setHits([]);
                setSearchError(null);
                setOpen(false);
                onClear();
              }}
              className="size-9 text-zinc-300 hover:bg-white/10 hover:text-white"
            >
              <X className="size-4" />
            </Button>
          ) : null}
        </div>

        {destination && !open ? (
          <div className="flex items-center justify-between gap-2 border-t border-white/8 px-3 py-2">
            <p className="min-w-0 truncate text-xs text-zinc-300">
              前往 {destination.label}
            </p>
            <div className="flex shrink-0 gap-1.5">
              <Button
                type="button"
                variant="ghost"
                onClick={onPreviewRoute}
                className="h-8 rounded-lg px-2 text-[11px] text-cyan-100 hover:bg-white/10"
              >
                檢視全線
              </Button>
              <Button
                type="button"
                onClick={onStartNav}
                className="h-8 rounded-lg bg-cyan-400/20 px-2 text-[11px] text-cyan-100 hover:bg-cyan-400/30"
              >
                開始導航
              </Button>
            </div>
          </div>
        ) : null}
      </div>

      {open ? (
        <div className="mt-1.5 overflow-hidden rounded-2xl border border-white/10 bg-black/78 shadow-xl backdrop-blur-xl">
          <p className="px-3 pt-2 text-[11px] text-zinc-500">
            從目前位置出發 · OpenStreetMap
          </p>
          {needle.length < 2 ? (
            <ul className="flex flex-wrap gap-1.5 px-3 py-2">
              {chips.map((chip) => (
                <li key={chip.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setQuery(chip.name);
                      setOpen(false);
                      onSelect(chip);
                    }}
                    className="rounded-full border border-white/10 bg-white/6 px-2.5 py-1 text-[11px] text-zinc-200 hover:bg-white/10 touch-manipulation"
                  >
                    {chip.name}
                  </button>
                </li>
              ))}
            </ul>
          ) : null}

          {searching || busy ? (
            <p className="flex items-center gap-2 px-3 py-3 text-sm text-zinc-400">
              <Loader2 className="size-4 animate-spin" />
              {busy ? "規劃路線中…" : "搜尋地址中…"}
            </p>
          ) : null}

          {!searching && !busy && visibleHits.length > 0 ? (
            <ul className="max-h-56 overflow-y-auto py-1">
              {visibleHits.map((hit) => (
                <li key={hit.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setQuery(hit.name);
                      setOpen(false);
                      onSelect(hit);
                    }}
                    className="flex w-full items-start gap-2.5 px-3 py-2.5 text-left hover:bg-white/8 touch-manipulation"
                  >
                    <MapPin className="mt-0.5 size-4 shrink-0 text-cyan-300" />
                    <span className="min-w-0">
                      <span className="block truncate text-sm text-white">
                        {hit.name}
                      </span>
                      <span className="block truncate text-[11px] text-zinc-500">
                        {hit.address}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : null}

          {!searching && !busy && (emptyHint || error) ? (
            <p className={cn("px-3 py-3 text-sm", error ? "text-amber-200" : "text-zinc-400")}>
              {error ?? emptyHint}
            </p>
          ) : null}
        </div>
      ) : null}

      {destination ? (
        <p className="mt-1 px-1 text-[11px] text-zinc-500">
          目的地 {destination.label}
          {destination.address && destination.address !== destination.label
            ? ` · ${destination.address}`
            : ""}
        </p>
      ) : null}
    </div>
  );
}
