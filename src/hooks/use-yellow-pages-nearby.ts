"use client";

import { useEffect, useState } from "react";
import type { MapPoiFeature } from "@/lib/map-place";
import type { PoiMainLayerId } from "@/lib/poi/main-layers";
import type { LngLat } from "@/types/domain";

export function useYellowPagesNearby({
  origin,
  layer,
}: {
  origin: LngLat | null;
  layer: PoiMainLayerId | null;
}) {
  const [pois, setPois] = useState<MapPoiFeature[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lng = origin?.lng ?? null;
  const lat = origin?.lat ?? null;
  const ready = Boolean(layer && lng != null && lat != null);

  useEffect(() => {
    if (!ready || !layer || lng == null || lat == null) return;
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setLoading(true);
      setError(null);
      const params = new URLSearchParams({
        nearby: "1",
        preferPhone: "1",
        layers: layer,
        lng: String(lng),
        lat: String(lat),
        radius: "2800",
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
  }, [layer, lat, lng, ready]);

  if (!ready) {
    return { pois: [] as MapPoiFeature[], loading: false, error: null };
  }
  return { pois, loading, error };
}
