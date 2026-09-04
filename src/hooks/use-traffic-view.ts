"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CITY_TRAFFIC_MOVE_REFRESH_KM,
  CITY_TRAFFIC_ZOOM_REFRESH_DELTA,
  TRAFFIC_LIVE_CACHE_MS,
} from "@/lib/traffic-constants";
import { mapVisibleTraffic, scoreTraffic } from "@/lib/traffic-query";
import type {
  LngLat,
  MapViewport,
  TrafficCatalog,
  TrafficDataOrigin,
  TrafficSegment,
} from "@/types/domain";

function quantizeCenter(point: LngLat, km = CITY_TRAFFIC_MOVE_REFRESH_KM): LngLat {
  const step = km / 111;
  return {
    lng: Math.round(point.lng / step) * step,
    lat: Math.round(point.lat / step) * step,
  };
}

function quantizeZoom(zoom: number) {
  return Math.round(zoom / CITY_TRAFFIC_ZOOM_REFRESH_DELTA) *
    CITY_TRAFFIC_ZOOM_REFRESH_DELTA;
}

const inflightKeys = new Set<string>();

async function fetchTrafficCatalog(
  force = false,
  external?: AbortSignal,
): Promise<TrafficCatalog> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), 12_000);
  const onAbort = () => controller.abort();
  if (external?.aborted) controller.abort();
  else external?.addEventListener("abort", onAbort, { once: true });
  try {
    const response = await fetch(
      force ? "/api/traffic?fresh=1" : "/api/traffic",
      { cache: "no-store", signal: controller.signal },
    );
    if (!response.ok) {
      throw new Error("traffic catalog failed");
    }
    const data = (await response.json()) as TrafficCatalog & {
      source?: string;
      updatedAt?: string;
      traffic?: TrafficCatalog["segments"];
    };
    return {
      origin: data.origin,
      segments: data.segments ?? data.traffic ?? [],
      fetchedAt: data.fetchedAt ?? data.updatedAt ?? new Date().toISOString(),
    };
  } finally {
    window.clearTimeout(timer);
    external?.removeEventListener("abort", onAbort);
  }
}

export function useTrafficView({
  queryOrigin,
  viewport,
  route,
  refreshNonce,
  nearbyFocusKm,
}: {
  queryOrigin: LngLat | null;
  viewport: MapViewport | null;
  route: [number, number][];
  refreshNonce: number;
  nearbyFocusKm?: number | null;
}) {
  const [catalog, setCatalog] = useState<TrafficSegment[]>([]);
  const [origin, setOrigin] = useState<TrafficDataOrigin>("unavailable");
  const [error, setError] = useState<string | null>(null);

  const searchLng = queryOrigin
    ? Number(quantizeCenter(queryOrigin).lng.toFixed(5))
    : null;
  const searchLat = queryOrigin
    ? Number(quantizeCenter(queryOrigin).lat.toFixed(5))
    : null;
  const searchCenter = useMemo(
    () =>
      searchLng == null || searchLat == null
        ? null
        : { lng: searchLng, lat: searchLat },
    [searchLat, searchLng],
  );
  const zoom = quantizeZoom(viewport?.zoom ?? 16.5);

  const applyCatalog = useCallback((result: TrafficCatalog) => {
    setCatalog(result.segments);
    setOrigin(result.origin);
    setError(null);
  }, []);

  useEffect(() => {
    const requestKey = refreshNonce > 0 ? "traffic:fresh" : "traffic:live";
    if (inflightKeys.has(requestKey)) return;
    const controller = new AbortController();
    inflightKeys.add(requestKey);
    void fetchTrafficCatalog(refreshNonce > 0, controller.signal)
      .then((result) => {
        if (controller.signal.aborted) return;
        applyCatalog(result);
      })
      .catch(() => {
        if (controller.signal.aborted) return;
        setCatalog([]);
        setOrigin("unavailable");
        setError("資料暫時無法取得");
      })
      .finally(() => {
        inflightKeys.delete(requestKey);
      });
    return () => {
      controller.abort();
      inflightKeys.delete(requestKey);
    };
  }, [applyCatalog, refreshNonce]);

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setInterval(() => {
      if (inflightKeys.has("traffic:live")) return;
      inflightKeys.add("traffic:live");
      void fetchTrafficCatalog(false, controller.signal)
        .then((result) => {
          if (!controller.signal.aborted) applyCatalog(result);
        })
        .catch(() => {
          if (!controller.signal.aborted) {
            setError("即時路況更新失敗，仍顯示上次資料。");
          }
        })
        .finally(() => {
          inflightKeys.delete("traffic:live");
        });
    }, TRAFFIC_LIVE_CACHE_MS);
    return () => {
      window.clearInterval(timer);
      controller.abort();
    };
  }, [applyCatalog]);

  const scored = useMemo(
    () =>
      catalog.length && searchCenter
        ? scoreTraffic(catalog, searchCenter, route)
        : [],
    [catalog, route, searchCenter],
  );

  const visibleViewport = useMemo<MapViewport | null>(() => {
    if (!viewport) return null;
    return { ...viewport, zoom };
  }, [viewport, zoom]);

  const visible = useMemo(
    () => mapVisibleTraffic(scored, visibleViewport, nearbyFocusKm ?? undefined),
    [nearbyFocusKm, scored, visibleViewport],
  );

  const reload = useCallback(() => {
    void fetchTrafficCatalog(true)
      .then(applyCatalog)
      .catch(() => {
        setCatalog([]);
        setOrigin("unavailable");
        setError("資料暫時無法取得");
      });
  }, [applyCatalog]);

  return {
    origin,
    catalog,
    scored,
    visible,
    error,
    reload,
  };
}
