"use client";

import { useEffect, useRef, useState } from "react";
import { searchAddresses } from "@/services/routing";
import type { GeocodeHit, LngLat } from "@/types/domain";

const DEBOUNCE_MS = 350;

export function useAddressSearch(
  query: string,
  bias: LngLat,
  composing: boolean,
  onSettled?: (rows: GeocodeHit[]) => void,
) {
  const [hits, setHits] = useState<GeocodeHit[]>([]);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const generationRef = useRef(0);
  const onSettledRef = useRef(onSettled);

  useEffect(() => {
    onSettledRef.current = onSettled;
  }, [onSettled]);

  useEffect(() => {
    const needle = query.trim();
    if (composing || needle.length < 2) {
      return;
    }

    const generation = generationRef.current + 1;
    generationRef.current = generation;
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setSearching(true);
      void searchAddresses(needle, bias, controller.signal)
        .then((rows) => {
          if (generation !== generationRef.current) return;
          setHits(rows);
          setError(rows.length ? null : "找不到店家、公司或地址，已改查附近巷弄或道路。");
          onSettledRef.current?.(rows);
        })
        .catch((cause: unknown) => {
          if (generation !== generationRef.current) return;
          if (cause instanceof DOMException && cause.name === "AbortError") return;
          setError("地址搜尋失敗，請稍後再試。");
        })
        .finally(() => {
          if (generation === generationRef.current) setSearching(false);
        });
    }, DEBOUNCE_MS);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [bias, composing, query]);

  const activeHits = query.trim().length < 2 ? [] : hits;
  const activeError = query.trim().length < 2 ? null : error;
  return { hits: activeHits, searching, error: activeError, setError };
}
