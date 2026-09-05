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
import { isDemoLandmarkPreset } from "@/data/landmarks";
import {
  clearAddressHistory,
  getAddressHistorySnapshot,
  getServerAddressHistorySnapshot,
  rememberAddress,
  removeAddressHistory,
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
import {
  formatTaiwanDisplayAddress,
  sameTaiwanDisplayTitle,
} from "@/lib/geocoding/format-taiwan-display-address";
import { matchKindLabel } from "@/lib/geocoding/normalizeTaiwanAddress";
import { formatDistance } from "@/lib/format";
import { distanceKm } from "@/lib/geo";
import {
  instantKeywordHits,
  mergeSearchHits,
  nearbyCategoryHint,
  rankSearchHits,
} from "@/lib/poi-search";
import { SEARCH_FIRST_SCREEN } from "@/lib/search-constants";
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
  const [expanded, setExpanded] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
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
      const displayHit = {
        ...hit,
        name: formatTaiwanDisplayAddress(hit.name),
        address: formatTaiwanDisplayAddress(hit.address),
      };
      speechStopRef.current();
      setQuery(displayHit.name);
      setOpen(false);
      rememberAddress(displayHit);
      void rememberGeocodeSelection(displayHit.name, biasBucket ?? undefined);
      onSelect(displayHit);
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
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      const root = rootRef.current;
      if (!root || root.contains(event.target as Node)) return;
      speechStopRef.current();
      setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      speechStopRef.current();
      setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown, true);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown, true);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  useEffect(() => {
    if (!pendingVoiceSubmitRef.current || composing) return;
    pendingVoiceSubmitRef.current = false;
    runFormalSearch(false);
  }, [composing, needle, runFormalSearch]);

  const searching = lookup.searching;
  const suggesting = lookup.suggesting && !lookup.submitted;
  const previewHits = lookup.submitted
    ? mergeSearchHits([...lookup.suggestHits, ...lookup.remoteHits], 24)
    : lookup.suggestHits;
  const visibleHits =
    needle.length < 1
      ? []
      : rankSearchHits(
          mergeSearchHits([...instantHits, ...previewHits], 24),
          needle,
          biasBucket,
        );
  const shownHits = expanded ? visibleHits : visibleHits.slice(0, SEARCH_FIRST_SCREEN);
  const userFavorites = useMemo(
    () => favorites.filter((hit) => !isDemoLandmarkPreset(hit)),
    [favorites],
  );
  const emptyHint =
    needle.length >= 1 && !searching && !busy && visibleHits.length === 0
      ? lookup.submitted
        ? "找不到符合的地點"
        : "輸入時會先找本機索引與紀錄。按搜尋或 Enter 再查門牌地圖。"
      : null;

  return (
    <div
      ref={rootRef}
      className="pointer-events-auto w-full min-w-0 max-w-full"
    >
      <div className="rounded-2xl border border-white/12 bg-black/60 shadow-[0_10px_40px_rgba(0,0,0,0.45)] backdrop-blur-xl">
        <div className="flex min-w-0 items-center gap-1 px-2 py-2 sm:gap-2 sm:px-2.5">
          <Search className="ml-1 size-4 shrink-0 text-zinc-400" aria-hidden />
          <Input
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setExpanded(false);
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
            className="h-10 min-w-0 flex-1 border-0 bg-transparent px-1 text-sm text-white shadow-none placeholder:text-zinc-500 focus-visible:ring-0"
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
        <div className="mt-1.5 max-h-[min(62dvh,calc(100dvh-8rem))] overflow-x-hidden overflow-y-auto rounded-2xl border border-white/10 bg-black/78 shadow-xl backdrop-blur-xl">
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
                {history.map((hit) => {
                  const title = formatTaiwanDisplayAddress(hit.name);
                  const subtitle = formatTaiwanDisplayAddress(hit.address);
                  return (
                    <li
                      key={`${hit.id}-${hit.location.lng}-${hit.location.lat}`}
                      className="flex items-center"
                    >
                      <button
                        type="button"
                        onClick={() => selectHit(hit)}
                        className="flex min-w-0 flex-1 items-start gap-2.5 px-2.5 py-2 text-left hover:bg-white/8 touch-manipulation"
                      >
                        <History className="mt-0.5 size-4 shrink-0 text-cyan-300/80" />
                        <span className="min-w-0">
                          <span className="block truncate text-sm text-white">
                            {title}
                          </span>
                          {subtitle && !sameTaiwanDisplayTitle(title, subtitle) ? (
                            <span className="block truncate text-[11px] text-zinc-500">
                              {subtitle}
                            </span>
                          ) : null}
                        </span>
                      </button>
                      <button
                        type="button"
                        aria-label={`刪除紀錄 ${title}`}
                        onClick={(event) => {
                          event.preventDefault();
                          event.stopPropagation();
                          removeAddressHistory(hit);
                        }}
                        className="mr-1 flex size-11 shrink-0 items-center justify-center rounded-full text-zinc-400 hover:bg-white/10 hover:text-white touch-manipulation"
                      >
                        <Trash2 className="size-4" />
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          ) : null}
          {needle.length < 1 && userFavorites.length ? (
            <div className="px-3 pt-1 pb-2">
              <p className="mb-1 text-[10px] text-rose-200/80">最愛書籤</p>
              <ul className="flex flex-wrap gap-1.5">
                {userFavorites.slice(0, 8).map((hit) => (
                  <li key={`fav-${hit.id}`}>
                    <button
                      type="button"
                      onClick={() => selectHit(hit)}
                      className="rounded-full border border-rose-300/25 bg-rose-500/15 px-2.5 py-1 text-[11px] text-rose-100 hover:bg-rose-500/25 touch-manipulation"
                    >
                      {formatTaiwanDisplayAddress(hit.name)}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {searching || suggesting || busy ? (
            <div
              className="mx-3 my-2 flex items-center gap-2 rounded-xl bg-white/8 px-3 py-2 text-sm text-white"
              role="status"
              aria-live="polite"
            >
              <Loader2 className="size-4 shrink-0 animate-spin text-cyan-200" />
              {busy ? "規劃路線中…" : "搜尋中…"}
            </div>
          ) : null}

          {!busy && shownHits.length > 0 ? (
            <ul className="max-h-56 overflow-y-auto py-1">
              {shownHits.map((hit) => {
                const meters =
                  hit.distanceMeters ??
                  (biasBucket
                    ? Math.round(distanceKm(biasBucket, hit.location) * 1000)
                    : undefined);
                return (
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
                        {formatTaiwanDisplayAddress(hit.name)}
                      </span>
                      {hit.address &&
                      !sameTaiwanDisplayTitle(hit.name, hit.address) ? (
                        <span className="block truncate text-[11px] text-zinc-500">
                          {formatTaiwanDisplayAddress(hit.address)}
                        </span>
                      ) : null}
                      {meters != null ? (
                        <span className="mt-0.5 block text-[11px] text-cyan-200/90">
                          {formatDistance(meters)}
                        </span>
                      ) : null}
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
                );
              })}
            </ul>
          ) : null}

          {!busy && !expanded && visibleHits.length > SEARCH_FIRST_SCREEN ? (
            <button
              type="button"
              onClick={() => setExpanded(true)}
              className="mx-3 mb-2 w-[calc(100%-1.5rem)] rounded-xl bg-white/8 px-3 py-2 text-sm text-white hover:bg-white/12 touch-manipulation"
            >
              顯示更多（{visibleHits.length - SEARCH_FIRST_SCREEN}）
            </button>
          ) : null}

          {!busy && visibleHits.length === 0 && (emptyHint || error) ? (
            <div className="px-3 py-3">
              <p className={cn("text-sm", error ? "text-amber-200" : "text-zinc-200")}>
                {error ?? emptyHint}
              </p>
              {lookup.submitted ? (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      setOpen(true);
                    }}
                    className="rounded-full bg-white/10 px-2.5 py-1 text-[11px] text-zinc-100 touch-manipulation"
                  >
                    修改關鍵字
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setQuery((current) => current);
                      runFormalSearch(false);
                    }}
                    className="rounded-full bg-white/10 px-2.5 py-1 text-[11px] text-zinc-100 touch-manipulation"
                  >
                    地址搜尋
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const next = nearbyCategoryHint(needle);
                      setQuery(next);
                      setOpen(true);
                    }}
                    className="rounded-full bg-white/10 px-2.5 py-1 text-[11px] text-zinc-100 touch-manipulation"
                  >
                    查看附近同類型
                  </button>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
