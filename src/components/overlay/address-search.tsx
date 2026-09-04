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
import { matchKindLabel } from "@/lib/geocoding/normalizeTaiwanAddress";
import {
  instantKeywordHits,
  mergeSearchHits,
  rankSearchHits,
} from "@/lib/poi-search";
import { useAddressSearch } from "@/hooks/use-address-search";
import { useSpeechToText } from "@/hooks/use-speech-to-text";
import { cn } from "@/lib/utils";
import { rememberGeocodeSelection } from "@/services/routing";
import type { GeocodeHit, LngLat } from "@/types/domain";

type AddressSearchProps = {
  bias: LngLat | null;
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
  const speechStopRef = useRef<() => void>(() => undefined);
  const biasLng = bias?.lng;
  const biasLat = bias?.lat;
  const biasBucket = useMemo(() => {
    if (biasLng == null || biasLat == null) return null;
    return {
      lng: Math.round(biasLng * 50) / 50,
      lat: Math.round(biasLat * 50) / 50,
    };
  }, [biasLat, biasLng]);
  const instantHits = useMemo(
    () =>
      needle.length < 1
        ? []
        : instantKeywordHits(needle, biasBucket, [...history, ...favorites]),
    [biasBucket, favorites, history, needle],
  );

  const selectHit = useCallback(
    (hit: GeocodeHit) => {
      speechStopRef.current();
      setQuery(hit.name);
      setOpen(false);
      rememberAddress(hit);
      void rememberGeocodeSelection(hit.name, biasBucket ?? undefined);
      onSelect(hit);
    },
    [biasBucket, onSelect],
  );
  const lookup = useAddressSearch(needle, biasBucket, composing);
  const pendingVoiceSubmitRef = useRef(false);

  const submitLookup = lookup.submit;
  const runFormalSearch = useCallback(
    (selectFirst = false) => {
      if (needle.length < 1 || composing) return;
      setOpen(true);
      submitLookup(needle, (rows) => {
        if (!selectFirst) return;
        const first = rows[0];
        if (first) selectHit(first);
      });
    },
    [composing, needle, selectHit, submitLookup],
  );

  const handleVoiceTranscript = useCallback((text: string, isFinal: boolean) => {
    setQuery(text);
    setOpen(true);
    setComposing(!isFinal);
    pendingVoiceSubmitRef.current = isFinal && text.trim().length >= 1;
  }, []);

  const speech = useSpeechToText(handleVoiceTranscript);

  useEffect(() => {
    speechStopRef.current = speech.stop;
  }, [speech.stop]);

  useEffect(() => {
    if (!pendingVoiceSubmitRef.current || composing) return;
    pendingVoiceSubmitRef.current = false;
    runFormalSearch(false);
  }, [composing, needle, runFormalSearch]);

  const searching = lookup.searching;
  const suggesting = lookup.suggesting && !lookup.submitted;
  const previewHits = lookup.submitted ? lookup.remoteHits : lookup.suggestHits;
  const visibleHits =
    needle.length < 1
      ? []
      : rankSearchHits(
          mergeSearchHits([...instantHits, ...previewHits], 24),
          needle,
          biasBucket,
        );
  const chips = useMemo(() => TAIWAN_LANDMARKS.slice(0, 5), []);
  const emptyHint =
    needle.length >= 1 && !searching && !busy && visibleHits.length === 0
      ? lookup.submitted
        ? lookup.error
        : "輸入時會先找紀錄、快取與附近店家。按搜尋或 Enter 再查門牌地圖。"
      : null;

  return (
    <div className="pointer-events-auto w-full max-w-xl">
      <div className="rounded-2xl border border-white/12 bg-black/60 shadow-[0_10px_40px_rgba(0,0,0,0.45)] backdrop-blur-xl">
        <div className="flex items-center gap-2 px-2.5 py-2">
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
              if (needle.length < 1) return;
              runFormalSearch(true);
            }}
            placeholder={speech.listening ? "正在聽…請說出目的地" : "地址、店家、公司、品牌或縮寫"}
            aria-label="目的地搜尋"
            className="h-10 border-0 bg-transparent px-1 text-sm text-white shadow-none placeholder:text-zinc-500 focus-visible:ring-0"
          />
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="搜尋門牌與地圖"
            title="搜尋門牌與地圖"
            disabled={needle.length < 1 || composing || searching || busy}
            onClick={() => runFormalSearch(false)}
            className="size-9 shrink-0 text-cyan-200 hover:bg-white/10 hover:text-white touch-manipulation disabled:text-zinc-500"
          >
            <Search className="size-4" />
          </Button>
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
              ? "正在聽取語音…說完後會查門牌與地圖"
              : lookup.submitted
                ? "已查門牌與地圖 · 點選結果開始導航"
                : "輸入中只顯示紀錄、快取與附近店家 · 按搜尋或 Enter 查門牌"}
          </p>
          {needle.length >= 1 ? (
            <button
              type="button"
              onClick={() => runFormalSearch(false)}
              disabled={composing || searching || busy}
              className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left hover:bg-white/8 touch-manipulation disabled:opacity-50"
            >
              <Search className="size-4 shrink-0 text-cyan-300" />
              <span className="min-w-0">
                <span className="block truncate text-sm text-white">
                  搜尋「{needle}」
                </span>
                <span className="block text-[11px] text-zinc-500">
                  查 TGOS、國土測量雲與地圖門牌
                </span>
              </span>
            </button>
          ) : null}
          {speech.error ? (
            <p className="px-3 pt-1 text-[11px] text-amber-200">{speech.error}</p>
          ) : null}
          {needle.length < 1 && history.length ? (
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
                        {hit.matchKind ? (
                          <span
                            className={cn(
                              "mt-0.5 inline-block rounded-full px-1.5 py-px text-[10px]",
                              hit.exactHouseNumber
                                ? "bg-cyan-400/15 text-cyan-200"
                                : "bg-white/8 text-zinc-400",
                            )}
                          >
                            {matchKindLabel(hit.matchKind)}
                          </span>
                        ) : null}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {needle.length < 1 && favorites.length ? (
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
          {needle.length < 1 ? (
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

          {searching || suggesting || busy ? (
            <p className="flex items-center gap-2 px-3 py-2 text-[11px] text-zinc-400">
              <Loader2 className="size-3.5 animate-spin" />
              {busy
                ? "規劃路線中…"
                : searching
                  ? "正在查門牌與地圖…"
                  : "比對紀錄與快取…"}
            </p>
          ) : null}

          {!busy && visibleHits.length > 0 ? (
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
                      {hit.matchKind ? (
                        <span
                          className={cn(
                            "mt-0.5 inline-block rounded-full px-1.5 py-px text-[10px]",
                            hit.exactHouseNumber
                              ? "bg-cyan-400/15 text-cyan-200"
                              : "bg-white/8 text-zinc-400",
                          )}
                        >
                          {matchKindLabel(hit.matchKind)}
                        </span>
                      ) : null}
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

          {!busy && visibleHits.length === 0 && (emptyHint || error) ? (
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
