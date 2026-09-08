"use client";

import { useEffect, useRef, useState } from "react";
import type { MapPoiFeature } from "@/lib/map-place";
import type { PoiMainLayerId } from "@/lib/poi/main-layers";
import type { LngLat, MapViewport } from "@/types/domain";

const MIN_POI_ZOOM = 10;

function quantize(value: number, step: number) {
  return Math.round(value / step) * step;
}

export function useMapPois({
  viewport,
  origin,
  enabled = true,
  layers,
}: {
  viewport: MapViewport | null;
  origin?: LngLat | null;
  enabled?: boolean;
  layers?: PoiMainLayerId[];
}) {
  const [pois, setPois] = useState<MapPoiFeature[]>([]);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const originRef = useRef(origin);
  const fetchedKeyRef = useRef<string | null>(null);
  const hideTimerRef = useRef<number | null>(null);
  const readGenRef = useRef(0);

  useEffect(() => {
    originRef.current = origin;
  }, [origin]);

  const zoom = viewport?.zoom ?? 0;
  const bounds = viewport?.bounds;
  const layerKey = layers?.length ? [...layers].sort().join(",") : "";
  const key =
    !enabled || !bounds || zoom < MIN_POI_ZOOM || !layerKey
      ? null
      : [
          quantize(bounds.west, 0.012).toFixed(3),
          quantize(bounds.south, 0.012).toFixed(3),
          quantize(bounds.east, 0.012).toFixed(3),
          quantize(bounds.north, 0.012).toFixed(3),
          (Math.round(zoom * 2) / 2).toFixed(1),
          layerKey,
        ].join(":");

  useEffect(() => {
    if (!enabled) {
      readGenRef.current += 1;
      fetchedKeyRef.current = null;
      if (hideTimerRef.current) {
        window.clearTimeout(hideTimerRef.current);
        hideTimerRef.current = null;
      }
      const reset = window.setTimeout(() => {
        setPois([]);
        setLoading(false);
        setProgress(0);
      }, 0);
      return () => window.clearTimeout(reset);
    }
    if (!key || !bounds) {
      if (hideTimerRef.current) {
        window.clearTimeout(hideTimerRef.current);
        hideTimerRef.current = null;
      }
      const reset = window.setTimeout(() => {
        setLoading(false);
        setProgress(0);
      }, 0);
      return () => window.clearTimeout(reset);
    }
    if (fetchedKeyRef.current === key) {
      return;
    }
    const readGen = ++readGenRef.current;
    const controller = new AbortController();
    const params = new URLSearchParams({
      west: String(bounds.west),
      south: String(bounds.south),
      east: String(bounds.east),
      north: String(bounds.north),
      layers: layerKey,
      limit: zoom >= 15.5 ? "980" : zoom >= 13.5 ? "840" : "700",
    });
    const here = originRef.current;
    if (here) {
      params.set("lng", String(here.lng));
      params.set("lat", String(here.lat));
    }

    let tick: number | null = null;
    const clearTick = () => {
      if (tick != null) {
        window.clearInterval(tick);
        tick = null;
      }
    };
    const beginRead = () => {
      if (readGenRef.current !== readGen) return;
      if (hideTimerRef.current) {
        window.clearTimeout(hideTimerRef.current);
        hideTimerRef.current = null;
      }
      setLoading(true);
      setProgress(8);
      tick = window.setInterval(() => {
        if (readGenRef.current !== readGen) return;
        setProgress((current) => {
          if (current >= 88) return current;
          return Math.min(88, current + Math.max(0.7, (88 - current) * 0.07));
        });
      }, 120);
    };
    const finishRead = (ok: boolean) => {
      if (readGenRef.current !== readGen) return;
      clearTick();
      if (!ok) {
        setLoading(false);
        setProgress(0);
        return;
      }
      setProgress(100);
      if (hideTimerRef.current) window.clearTimeout(hideTimerRef.current);
      hideTimerRef.current = window.setTimeout(() => {
        if (readGenRef.current !== readGen) return;
        setLoading(false);
        setProgress(0);
        hideTimerRef.current = null;
      }, 80);
    };

    const delay = fetchedKeyRef.current ? 40 : 0;
    const timer = window.setTimeout(() => {
      beginRead();
      void fetch(`/api/pois?${params}`, { signal: controller.signal })
        .then(async (response) => {
          if (!response.ok) throw new Error("poi viewport failed");
          return response.json() as Promise<{ pois?: MapPoiFeature[] }>;
        })
        .then((data) => {
          if (controller.signal.aborted) return;
          fetchedKeyRef.current = key;
          setPois(data.pois ?? []);
          finishRead(true);
        })
        .catch(() => {
          if (!controller.signal.aborted) {
            finishRead(false);
          }
        });
    }, delay);
    return () => {
      window.clearTimeout(timer);
      clearTick();
      controller.abort();
    };
  }, [bounds, enabled, key, layerKey, zoom]);

  useEffect(() => {
    return () => {
      if (hideTimerRef.current) window.clearTimeout(hideTimerRef.current);
    };
  }, []);

  const reading = Boolean(key) && loading;
  return {
    pois,
    loading: reading,
    progress: reading ? progress : 0,
  };
}
