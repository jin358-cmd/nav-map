"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
} from "react";
import { History, Loader2, MapPin, Search, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TAIWAN_LANDMARKS } from "@/data/landmarks";
import {
  clearAddressHistory,
  getAddressHistorySnapshot,
  getServerAddressHistorySnapshot,
  rememberAddress,
  subscribeAddressHistory,
} from "@/lib/address-history";
import { cn } from "@/lib/utils";
import { searchAddresses } from "@/services/routing";
import type { GeocodeHit, LngLat } from "@/types/domain";

type AddressSearchProps = {
  bias: LngLat;
  busy: boolean;
  error: string | null;
  onSelect: (hit: GeocodeHit) => void;
};

export function AddressSearch({
  bias,
  busy,
  error,
  onSelect,
}: AddressSearchProps) {
  const [query, setQuery] = useState("");
  const [composing, setComposing] = useState(false);
  const [open, setOpen] = useState(false);
  const [hits, setHits] = useState<GeocodeHit[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const history = useSyncExternalStore(
    subscribeAddressHistory,
    getAddressHistorySnapshot,
    getServerAddressHistorySnapshot,
  );
  const needle = query.trim();
  const biasBucket = useMemo(
    () => ({
      lng: Math.round(bias.lng * 50) / 50,
      lat: Math.round(bias.lat * 50) / 50,
    }),
    [bias.lat, bias.lng],
  );

  const selectHit = useCallback(
    (hit: GeocodeHit) => {
      setQuery(hit.name);
      setOpen(false);
      rememberAddress(hit);
      onSelect(hit);
    },
    [onSelect],
  );

  useEffect(() => {
    if (composing || needle.length < 2) return;

    let cancelled = false;
    const timer = window.setTimeout(() => {
      setSearching(true);
      void searchAddresses(needle, biasBucket)
        .then((rows) => {
          if (cancelled) return;
          setHits(rows);
          setSearchError(rows.length ? null : "找不到這個地址，請換個關鍵字。");
        })
        .catch(() => {
          if (cancelled) return;
          setHits([]);
          setSearchError("地址搜尋失敗，請稍後再試。");
        })
        .finally(() => {
          if (!cancelled) setSearching(false);
        });
    }, 420);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [biasBucket, composing, needle]);

  const visibleHits = needle.length < 2 ? [] : hits;
  const chips = useMemo(() => TAIWAN_LANDMARKS.slice(0, 5), []);
  const emptyHint =
    needle.length >= 2 && !searching && !busy ? searchError : null;

  return (
    <div className="pointer-events-auto w-full max-w-xl">
      {history.length ? (
        <div className="mb-1.5 flex items-center gap-1.5 overflow-hidden rounded-2xl border border-white/10 bg-black/55 px-2 py-1.5 shadow-lg backdrop-blur-xl">
          <History className="ml-1 size-3.5 shrink-0 text-cyan-300/80" />
          <span className="shrink-0 text-[10px] text-zinc-500">搜尋紀錄</span>
          <div className="flex min-w-0 flex-1 gap-1 overflow-x-auto">
            {history.map((hit) => (
              <button
                key={`${hit.id}-${hit.location.lng}-${hit.location.lat}`}
                type="button"
                title={hit.name}
                onClick={() => selectHit(hit)}
                className="max-w-40 shrink-0 truncate rounded-full border border-white/10 bg-white/6 px-2 py-1 text-[10px] text-zinc-200 hover:bg-white/10 touch-manipulation"
              >
                {hit.name}
              </button>
            ))}
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="清除搜尋紀錄"
            onClick={clearAddressHistory}
            className="size-7 shrink-0 text-zinc-500 hover:bg-white/10 hover:text-white"
          >
            <Trash2 className="size-3.5" />
          </Button>
        </div>
      ) : null}
      <div className="rounded-2xl border border-white/12 bg-black/60 shadow-[0_10px_40px_rgba(0,0,0,0.45)] backdrop-blur-xl">
        <div className="flex items-center gap-2 px-2.5 py-2">
          <Search className="ml-1 size-4 shrink-0 text-cyan-300" />
          <Input
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setOpen(true);
            }}
            onCompositionStart={() => setComposing(true)}
            onCompositionEnd={(event) => {
              setComposing(false);
              setQuery(event.currentTarget.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            placeholder="輸入地址、路口或地標"
            aria-label="目的地地址"
            className="h-10 border-0 bg-transparent px-1 text-sm text-white shadow-none placeholder:text-zinc-500 focus-visible:ring-0"
          />
          {query ? (
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
              }}
              className="size-9 text-zinc-300 hover:bg-white/10 hover:text-white"
            >
              <X className="size-4" />
            </Button>
          ) : null}
        </div>
      </div>

      {open ? (
        <div className="mt-1.5 overflow-hidden rounded-2xl border border-white/10 bg-black/78 shadow-xl backdrop-blur-xl">
          <p className="px-3 pt-2 text-[11px] text-zinc-500">
            從目前位置出發 · 戶政門牌優先，地政資料交叉比對
          </p>
          {needle.length < 2 ? (
            <ul className="flex flex-wrap gap-1.5 px-3 py-2">
              {chips.map((chip) => (
                <li key={chip.id}>
                  <button
                    type="button"
                    onClick={() => {
                      selectHit(chip);
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
                      selectHit(hit);
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
            <p
              className={cn(
                "px-3 py-3 text-sm",
                error ? "text-amber-200" : "text-zinc-400",
              )}
            >
              {error ?? emptyHint}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
