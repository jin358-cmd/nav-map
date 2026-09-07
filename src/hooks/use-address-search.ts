"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { SearchRegion } from "@/lib/poi-search";
import { SUGGEST_DEBOUNCE_MS, SUGGEST_MIN_CHARS } from "@/lib/search-constants";
import { searchAddresses } from "@/services/routing";
import type { GeocodeHit, LngLat } from "@/types/domain";

export function useAddressSearch(
  query: string,
  bias: LngLat | null,
  composing: boolean,
  region: SearchRegion | null = null,
) {
  const [suggestHits, setSuggestHits] = useState<GeocodeHit[]>([]);
  const [suggestFor, setSuggestFor] = useState("");
  const [remoteHits, setRemoteHits] = useState<GeocodeHit[]>([]);
  const [submittedQuery, setSubmittedQuery] = useState("");
  const [suggesting, setSuggesting] = useState(false);
  const [searchingMore, setSearchingMore] = useState(false);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [suggestSettled, setSuggestSettled] = useState(true);
  const suggestGenerationRef = useRef(0);
  const searchGenerationRef = useRef(0);
  const searchAbortRef = useRef<AbortController | null>(null);
  const biasLng = bias?.lng;
  const biasLat = bias?.lat;
  const locatedCity = region?.city ?? "";
  const locatedTown = region?.town ?? "";
  const needle = query.trim();
  const submitted = submittedQuery.length > 0 && submittedQuery === needle;

  useEffect(() => {
    if (composing || needle.length < SUGGEST_MIN_CHARS) {
      return;
    }

    const generation = suggestGenerationRef.current + 1;
    suggestGenerationRef.current = generation;
    const controller = new AbortController();
    const origin =
      biasLng != null && biasLat != null
        ? { lng: biasLng, lat: biasLat }
        : undefined;
    const regionArg =
      locatedCity || locatedTown
        ? { city: locatedCity, town: locatedTown }
        : undefined;
    const timer = window.setTimeout(() => {
      setSuggesting(true);
      setSearchingMore(false);
      void searchAddresses(needle, origin, controller.signal, "suggest", regionArg)
        .then(async (rows) => {
          if (generation !== suggestGenerationRef.current) return;
          setSuggestFor(needle);
          if (rows.length) {
            setSuggestHits(rows);
            setSearchingMore(false);
            return;
          }
          setSuggestHits([]);
          if (needle.length < 2) return;
          setSearchingMore(true);
          const extra = await searchAddresses(
            needle,
            origin,
            controller.signal,
            "search",
            regionArg,
          );
          if (generation !== suggestGenerationRef.current) return;
          setSuggestHits(extra);
          setSuggestFor(needle);
        })
        .catch((cause: unknown) => {
          if (generation !== suggestGenerationRef.current) return;
          if (cause instanceof DOMException && cause.name === "AbortError") return;
          setSuggestHits([]);
          setSuggestFor(needle);
        })
        .finally(() => {
          if (generation !== suggestGenerationRef.current) return;
          setSuggesting(false);
          setSearchingMore(false);
          setSuggestSettled(true);
        });
    }, SUGGEST_DEBOUNCE_MS);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [biasLat, biasLng, composing, locatedCity, locatedTown, needle]);

  useEffect(() => {
    if (!submittedQuery || needle === submittedQuery) return;
    searchAbortRef.current?.abort();
  }, [needle, submittedQuery]);

  useEffect(() => {
    return () => {
      searchAbortRef.current?.abort();
    };
  }, []);

  const submit = useCallback(
    (text: string, onSettled?: (rows: GeocodeHit[]) => void) => {
      const next = text.trim();
      if (next.length < 1) return;

      searchAbortRef.current?.abort();
      const generation = searchGenerationRef.current + 1;
      searchGenerationRef.current = generation;
      const controller = new AbortController();
      searchAbortRef.current = controller;
      setSubmittedQuery(next);
      setRemoteHits([]);
      setSearching(true);
      setError(null);
      const origin =
        biasLng != null && biasLat != null
          ? { lng: biasLng, lat: biasLat }
          : undefined;

      void searchAddresses(
        next,
        origin,
        controller.signal,
        "search",
        locatedCity || locatedTown
          ? { city: locatedCity, town: locatedTown }
          : undefined,
      )
        .then((rows) => {
          if (generation !== searchGenerationRef.current) return;
          setRemoteHits(rows);
          setError(rows.length ? null : "找不到符合的地點");
          onSettled?.(rows);
        })
        .catch((cause: unknown) => {
          if (generation !== searchGenerationRef.current) return;
          if (cause instanceof DOMException && cause.name === "AbortError") return;
          setError("地址搜尋失敗，請稍後再試。");
        })
        .finally(() => {
          if (generation === searchGenerationRef.current) setSearching(false);
        });
    },
    [biasLat, biasLng, locatedCity, locatedTown],
  );

  const hitsForNeedle = suggestFor === needle ? suggestHits : [];
  const settledForNeedle = needle.length < SUGGEST_MIN_CHARS || (suggestFor === needle && suggestSettled);

  return {
    suggestHits: needle.length < SUGGEST_MIN_CHARS ? [] : hitsForNeedle,
    remoteHits: submitted ? remoteHits : [],
    submitted,
    suggesting: needle.length >= SUGGEST_MIN_CHARS && suggesting,
    searchingMore: needle.length >= SUGGEST_MIN_CHARS && searchingMore,
    suggestSettled: settledForNeedle,
    searching: submitted && searching,
    error: submitted && needle.length >= 1 ? error : null,
    submit,
    setError,
  };
}
