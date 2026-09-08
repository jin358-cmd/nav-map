"use client";

import { useEffect, useRef, useState } from "react";
import type { MapPoiFeature } from "@/lib/map-place";
import type { LngLat, MapViewport } from "@/types/domain";

function quantize(value: number, step: number) {
  return Math.round(value / step) * step;
}

export function useMapPois({
  viewport,
  origin,
  enabled = true,
}: {
  viewport: MapViewport | null;
  origin?: LngLat | null;
  enabled?: boolean;
}) {
  const [pois, setPois] = useState<MapPoiFeature[]>([]);
  const originRef = useRef(origin);
  const fetchedKeyRef = useRef<string | null>(null);

  useEffect(() => {
    originRef.current = origin;
  }, [origin]);

  const zoom = viewport?.zoom ?? 0;
  const bounds = viewport?.bounds;
  const key =
    !enabled || !bounds || zoom < 11.5
      ? null
      : [
          quantize(bounds.west, 0.012).toFixed(3),
          quantize(bounds.south, 0.012).toFixed(3),
          quantize(bounds.east, 0.012).toFixed(3),
          quantize(bounds.north, 0.012).toFixed(3),
          Math.round(zoom),
        ].join(":");

  useEffect(() => {
    if (!key || !bounds) {
      return;
    }
    if (fetchedKeyRef.current === key) {
      return;
    }
    const controller = new AbortController();
    const params = new URLSearchParams({
      west: String(bounds.west),
      south: String(bounds.south),
      east: String(bounds.east),
      north: String(bounds.north),
      limit: zoom >= 15.5 ? "980" : zoom >= 13.5 ? "840" : "700",
    });
    const here = originRef.current;
    if (here) {
      params.set("lng", String(here.lng));
      params.set("lat", String(here.lat));
    }
    const delay = fetchedKeyRef.current ? 80 : 0;
    const timer = window.setTimeout(() => {
      void fetch(`/api/pois?${params}`, { signal: controller.signal })
        .then(async (response) => {
          if (!response.ok) throw new Error("poi viewport failed");
          return response.json() as Promise<{ pois?: MapPoiFeature[] }>;
        })
        .then((data) => {
          if (controller.signal.aborted) return;
          fetchedKeyRef.current = key;
          setPois(data.pois ?? []);
        })
        .catch(() => {
          if (!controller.signal.aborted) setPois([]);
        });
    }, delay);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [bounds, key, zoom]);

  return key ? pois : [];
}
