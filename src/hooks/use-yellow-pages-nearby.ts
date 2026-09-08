"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { MapPoiFeature } from "@/lib/map-place";
import { distanceKm } from "@/lib/geo";
import type { SearchShortcutId } from "@/lib/search-shortcuts";
import { searchShortcutById } from "@/lib/search-shortcuts";
import type { LngLat } from "@/types/domain";

export type NearbyShortcutPoi = MapPoiFeature & { distanceMeters: number };

function quantizeNearbyOrigin(origin: LngLat | null): LngLat | null {
  if (!origin) return null;
  const step = 0.0012;
  return {
    lng: Math.round(origin.lng / step) * step,
    lat: Math.round(origin.lat / step) * step,
  };
}

export function useYellowPagesNearby({
  origin,
  shortcut,
}: {
  origin: LngLat | null;
  shortcut: SearchShortcutId | null;
}) {
  const [pois, setPois] = useState<NearbyShortcutPoi[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fetchedFor, setFetchedFor] = useState<SearchShortcutId | null>(null);
  const originLng = origin?.lng ?? null;
  const originLat = origin?.lat ?? null;
  const bucket = useMemo(
    () =>
      originLng == null || originLat == null
        ? null
        : quantizeNearbyOrigin({ lng: originLng, lat: originLat }),
    [originLat, originLng],
  );
  const lng = bucket?.lng ?? null;
  const lat = bucket?.lat ?? null;
  const selected = searchShortcutById(shortcut);
  const selectedId = selected?.id ?? null;
  const ready = Boolean(selected && lng != null && lat != null);
  const shortcutRef = useRef<SearchShortcutId | null>(null);

  useEffect(() => {
    if (!selected || lng == null || lat == null) return;

    const shortcutChanged = shortcutRef.current !== selected.id;
    shortcutRef.current = selected.id;
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      if (shortcutChanged) setLoading(true);
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
          const originFix = { lng, lat };
          setFetchedFor(selected.id);
          setPois(
            (data.pois ?? []).map((poi) => ({
              ...poi,
              distanceMeters: Math.round(distanceKm(originFix, poi.location) * 1000),
            })),
          );
          setLoading(false);
        })
        .catch(() => {
          if (controller.signal.aborted) return;
          setFetchedFor(selected.id);
          setLoading(false);
          setError("附近店家讀取失敗");
        });
    }, shortcutChanged ? 0 : 280);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [lat, lng, selected]);

  if (!ready || !selectedId) {
    return { pois: [] as NearbyShortcutPoi[], loading: false, error: null };
  }
  const stale = fetchedFor !== selectedId;
  return {
    pois: stale ? [] : pois,
    loading: stale || loading,
    error: stale ? null : error,
  };
}
