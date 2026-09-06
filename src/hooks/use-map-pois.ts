"use client";

import { useEffect, useState } from "react";
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
  const zoom = viewport?.zoom ?? 0;
  const bounds = viewport?.bounds;
  const key =
    !enabled || !bounds || zoom < 13.3
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
    const controller = new AbortController();
    const params = new URLSearchParams({
      west: String(bounds.west),
      south: String(bounds.south),
      east: String(bounds.east),
      north: String(bounds.north),
      limit: zoom >= 16 ? "96" : zoom >= 14.5 ? "72" : "48",
    });
    if (origin) {
      params.set("lng", String(origin.lng));
      params.set("lat", String(origin.lat));
    }
    const timer = window.setTimeout(() => {
      void fetch(`/api/pois?${params}`, { signal: controller.signal })
        .then(async (response) => {
          if (!response.ok) throw new Error("poi viewport failed");
          return response.json() as Promise<{ pois?: MapPoiFeature[] }>;
        })
        .then((data) => {
          if (!controller.signal.aborted) setPois(data.pois ?? []);
        })
        .catch(() => {
          if (!controller.signal.aborted) setPois([]);
        });
    }, 220);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [bounds, key, origin, zoom]);

  return key ? pois : [];
}
