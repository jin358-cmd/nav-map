"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { Heart, History, Loader2, MapPin, Mic, Search, Trash2, X } from "lucide-react";
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
import {
  addFavorite,
  getFavoritesSnapshot,
  getServerFavoritesSnapshot,
  isFavorite,
  removeFavorite,
  subscribeFavorites,
} from "@/lib/favorites";
import { useSpeechToText } from "@/hooks/use-speech-to-text";
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
  const favorites = useSyncExternalStore(
    subscribeFavorites,
    getFavoritesSnapshot,
    getServerFavoritesSnapshot,
  );
  const needle = query.trim();
  const submitFirstHitRef = useRef(false);
  const speechStopRef = useRef<() => void>(() => undefined);
  const biasBucket = useMemo(
    () => ({
      lng: Math.round(bias.lng * 50) / 50,
      lat: Math.round(bias.lat * 50) / 50,
    }),
    [bias.lat, bias.lng],
  );

  const selectHit = useCallback(
    (hit: GeocodeHit) => {
      speechStopRef.current();
      setQuery(hit.name);
      setOpen(false);
      rememberAddress(hit);
      onSelect(hit);
    },
    [onSelect],
  );

  const handleVoiceTranscript = useCallback((text: string, isFinal: boolean) => {
    setQuery(text);
    setOpen(true);
    setComposing(!isFinal);
  }, []);

  const speech = useSpeechToText(handleVoiceTranscript);

  useEffect(() => {
    speechStopRef.current = speech.stop;
  }, [speech.stop]);

  useEffect(() => {
    if (composing || needle.length < 2) return;

    let cancelled = false;
    const timer = window.setTimeout(() => {
      setSearching(true);
      void searchAddresses(needle, biasBucket)
        .then((rows) => {
          if (cancelled) return;
          setHits(rows);
          setSearchError(
            rows.length ? null : "找不到店家、公司或地址，請換關鍵字或縮寫。",
          );
          if (submitFirstHitRef.current && rows[0]) {
            submitFirstHitRef.current = false;
            selectHit(rows[0]);
          }
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
  }, [biasBucket, composing, needle, selectHit]);

  const visibleHits = needle.length < 2 ? [] : hits;
  const chips = useMemo(() => TAIWAN_LANDMARKS.slice(0, 5), []);
  const emptyHint =
    needle.length >= 2 && !searching && !busy ? searchError : null;

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
            onCompositionStart={() => setComposing(true)}
            onCompositionEnd={(event) => {
              setComposing(false);
              setQuery(event.currentTarget.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            onKeyDown={(event) => {
              if (event.key !== "Enter" || composing) return;
              event.preventDefault();
              if (hits[0]) {
                selectHit(hits[0]);
                return;
              }
              if (needle.length >= 2) submitFirstHitRef.current = true;
            }}
            placeholder={speech.listening ? "正在聽…請說出目的地" : "地址、店家、公司、品牌或縮寫"}
            aria-label="目的地搜尋"
            className="h-10 border-0 bg-transparent px-1 text-sm text-white shadow-none placeholder:text-zinc-500 focus-visible:ring-0"
          />
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={speech.listening ? "停止語音輸入" : "語音搜尋"}
            aria-pressed={speech.listening}
            title={speech.supported ? "語音轉文字" : "此瀏覽器不支援語音輸入"}
            onClick={() => {
              setOpen(true);
              speech.toggle();
            }}
            className={cn(
              "size-9 shrink-0 touch-manipulation",
              speech.listening
                ? "bg-cyan-400/20 text-cyan-200 hover:bg-cyan-400/30 hover:text-white"
                : "text-zinc-300 hover:bg-white/10 hover:text-white",
            )}
          >
            <Mic className={cn("size-4", speech.listening && "animate-pulse")} />
          </Button>
          {query ? (
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label="清除"
              onClick={() => {
                speech.stop();
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
            {speech.listening
              ? "正在聽取語音…說完後會自動搜尋"
              : "全市約 20 公里 · 店家／公司／品牌／縮寫 · 長按地圖自訂位置"}
          </p>
          {speech.error ? (
            <p className="px-3 pt-1 text-[11px] text-amber-200">{speech.error}</p>
          ) : null}
          {needle.length < 2 && history.length ? (
            <div className="px-1 pt-1">
              <div className="flex items-center justify-between px-2">
                <p className="flex items-center gap-1.5 text-[11px] text-cyan-200/85">
                  <History className="size-3.5" />
                  輸入紀錄
                </p>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label="清除搜尋紀錄"
                  onClick={clearAddressHistory}
                  className="size-7 text-zinc-500 hover:bg-white/10 hover:text-white"
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
              <ul className="max-h-52 overflow-y-auto py-0.5">
                {history.map((hit) => (
                  <li key={`${hit.id}-${hit.location.lng}-${hit.location.lat}`}>
                    <button
                      type="button"
                      onClick={() => selectHit(hit)}
                      className="flex w-full items-start gap-2.5 px-2.5 py-2 text-left hover:bg-white/8 touch-manipulation"
                    >
                      <History className="mt-0.5 size-4 shrink-0 text-cyan-300/80" />
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
            </div>
          ) : null}
          {needle.length < 2 && favorites.length ? (
            <div className="px-3 pt-1">
              <p className="mb-1 text-[10px] text-rose-200/80">最愛書籤</p>
              <ul className="flex flex-wrap gap-1.5">
                {favorites.slice(0, 8).map((hit) => (
                  <li key={`fav-${hit.id}`}>
                    <button
                      type="button"
                      onClick={() => selectHit(hit)}
                      className="rounded-full border border-rose-300/25 bg-rose-500/15 px-2.5 py-1 text-[11px] text-rose-100 hover:bg-rose-500/25 touch-manipulation"
                    >
                      {hit.name}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
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
                <li key={hit.id} className="flex items-start">
                  <button
                    type="button"
                    onClick={() => {
                      selectHit(hit);
                    }}
                    className="flex min-w-0 flex-1 items-start gap-2.5 px-3 py-2.5 text-left hover:bg-white/8 touch-manipulation"
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
                  <button
                    type="button"
                    aria-label={isFavorite(hit) ? "移出最愛" : "加入最愛"}
                    onClick={() => {
                      if (isFavorite(hit)) removeFavorite(hit);
                      else addFavorite(hit);
                    }}
                    className="mt-1.5 mr-2 flex size-8 shrink-0 items-center justify-center rounded-full text-rose-300 hover:bg-white/10 touch-manipulation"
                  >
                    <Heart
                      className={cn(
                        "size-4",
                        isFavorite(hit) && "fill-rose-500 text-rose-400",
                      )}
                    />
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
