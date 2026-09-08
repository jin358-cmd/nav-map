"use client";

import { useEffect, useState } from "react";
import type { MapPoiFeature } from "@/lib/map-place";
import type { SearchShortcutId } from "@/lib/search-shortcuts";
import { searchShortcutById } from "@/lib/search-shortcuts";
import type { LngLat } from "@/types/domain";

export function useYellowPagesNearby({
  origin,
  shortcut,
}: {
  origin: LngLat | null;
  shortcut: SearchShortcutId | null;
}) {
  const [pois, setPois] = useState<MapPoiFeature[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lng = origin?.lng ?? null;
  const lat = origin?.lat ?? null;
  const selected = searchShortcutById(shortcut);
  const ready = Boolean(selected && lng != null && lat != null);

  useEffect(() => {
    if (!ready || !selected || lng == null || lat == null) return;
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setLoading(true);
      setError(null);
      const params = new URLSearchParams({
        nearby: "1",
        categories: selected.categories.join(","),
        lng: String(lng),
        lat: String(lat),
        radius: selected.id === "fuel" ? "4200" : "2800",
        limit: "14",
      });
      void fetch(`/api/pois?${params}`, { signal: controller.signal })
        .then(async (response) => {
          if (!response.ok) throw new Error("nearby failed");
          return response.json() as Promise<{ pois?: MapPoiFeature[] }>;
        })
        .then((data) => {
          if (controller.signal.aborted) return;
          setPois(data.pois ?? []);
          setLoading(false);
        })
        .catch(() => {
          if (controller.signal.aborted) return;
          setPois([]);
          setLoading(false);
          setError("附近店家讀取失敗");
        });
    }, 0);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [lat, lng, ready, selected]);

  if (!ready) {
    return { pois: [] as MapPoiFeature[], loading: false, error: null };
  }
  return { pois, loading, error };
}
