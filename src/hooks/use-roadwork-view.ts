"use client";

import { useCallback, useEffect, useState } from "react";
import type { RoadworkCatalogResponse, RoadworkEvent } from "@/lib/roadwork/public";

const EMPTY: RoadworkCatalogResponse = {
  origin: "degraded",
  degradedReason: "upstream",
  fetchedAt: "",
  previewLabel: null,
  mapEvents: [],
  notices: [],
  counts: { input: 0, unique: 0, mapVisible: 0, notices: 0 },
  closureAvoidanceEnabled: false,
};

async function fetchCatalog(sample: "structural" | null): Promise<RoadworkCatalogResponse> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), 12_000);
  try {
    const suffix = sample === "structural" ? "?sample=structural" : "";
    const response = await fetch(`/api/roadwork${suffix}`, {
      cache: "no-store",
      signal: controller.signal,
    });
    if (!response.ok) throw new Error("roadwork failed");
    const data = (await response.json()) as RoadworkCatalogResponse;
    return {
      ...EMPTY,
      ...data,
      mapEvents: Array.isArray(data.mapEvents) ? data.mapEvents : [],
      notices: Array.isArray(data.notices) ? data.notices : [],
      closureAvoidanceEnabled: false,
    };
  } finally {
    window.clearTimeout(timer);
  }
}

export function useRoadworkView(refreshNonce: number) {
  const [catalog, setCatalog] = useState<RoadworkCatalogResponse>(EMPTY);
  const [error, setError] = useState<string | null>(null);
  const [sample, setSample] = useState<"structural" | null>(null);

  const apply = useCallback((result: RoadworkCatalogResponse) => {
    setCatalog({ ...result, closureAvoidanceEnabled: false });
    setError(result.origin === "degraded" && result.degradedReason !== "unconfigured" && result.degradedReason !== "empty"
      ? "施工資料暫時無法載入。地圖不顯示施工標記。"
      : null);
  }, []);

  useEffect(() => {
    let cancelled = false;
    void fetchCatalog(sample)
      .then((result) => {
        if (!cancelled) apply(result);
      })
      .catch(() => {
        if (cancelled) return;
        setCatalog(EMPTY);
        setError("施工資料暫時無法載入。地圖不顯示施工標記。");
      });
    return () => {
      cancelled = true;
    };
  }, [apply, refreshNonce, sample]);

  const events: RoadworkEvent[] = [...catalog.mapEvents, ...catalog.notices];

  return {
    catalog,
    events,
    error,
    showStructuralSample: () => setSample("structural"),
    clearSample: () => setSample(null),
    sample,
  };
}
