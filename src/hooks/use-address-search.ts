"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { searchAddresses } from "@/services/routing";
import type { GeocodeHit, LngLat } from "@/types/domain";

const SUGGEST_DEBOUNCE_MS = 350;

export function useAddressSearch(
  query: string,
  bias: LngLat | null,
  composing: boolean,
) {
  const [suggestHits, setSuggestHits] = useState<GeocodeHit[]>([]);
  const [remoteHits, setRemoteHits] = useState<GeocodeHit[]>([]);
  const [submittedQuery, setSubmittedQuery] = useState("");
  const [suggesting, setSuggesting] = useState(false);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const suggestGenerationRef = useRef(0);
  const searchGenerationRef = useRef(0);
  const searchAbortRef = useRef<AbortController | null>(null);
  const biasLng = bias?.lng;
  const biasLat = bias?.lat;
  const needle = query.trim();
  const submitted = submittedQuery.length > 0 && submittedQuery === needle;

  useEffect(() => {
    if (composing || needle.length < 2) {
      return;
    }

    const generation = suggestGenerationRef.current + 1;
    suggestGenerationRef.current = generation;
    const controller = new AbortController();
    const origin =
      biasLng != null && biasLat != null
        ? { lng: biasLng, lat: biasLat }
        : undefined;
    const timer = window.setTimeout(() => {
      setSuggesting(true);
      void searchAddresses(needle, origin, controller.signal, "suggest")
        .then((rows) => {
          if (generation !== suggestGenerationRef.current) return;
          setSuggestHits(rows);
        })
        .catch((cause: unknown) => {
          if (generation !== suggestGenerationRef.current) return;
          if (cause instanceof DOMException && cause.name === "AbortError") return;
          setSuggestHits([]);
        })
        .finally(() => {
          if (generation === suggestGenerationRef.current) setSuggesting(false);
        });
    }, SUGGEST_DEBOUNCE_MS);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [biasLat, biasLng, composing, needle]);

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
      setSearching(true);
      setError(null);
      const origin =
        biasLng != null && biasLat != null
          ? { lng: biasLng, lat: biasLat }
          : undefined;

      void searchAddresses(next, origin, controller.signal, "search")
        .then((rows) => {
          if (generation !== searchGenerationRef.current) return;
          setRemoteHits(rows);
          setError(
            rows.length ? null : "找不到店家、公司或地址，已改查附近巷弄或道路。",
          );
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
    [biasLat, biasLng],
  );

  return {
    suggestHits: needle.length < 2 ? [] : suggestHits,
    remoteHits: submitted ? remoteHits : [],
    submitted,
    suggesting: needle.length >= 2 && suggesting,
    searching: submitted && searching,
    error: submitted && needle.length >= 1 ? error : null,
    submit,
    setError,
  };
}
