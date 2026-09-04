"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CCTV_MOVE_REFRESH_KM } from "@/lib/cctv-constants";
import {
  mapVisibleCameras,
  previewCameras,
  scoreCameras,
} from "@/lib/cctv-query";
import { fetchCctvCatalog } from "@/services/cctv";
import type {
  CctvCamera,
  CctvDataOrigin,
  LngLat,
  MapViewport,
} from "@/types/domain";

function quantizeCenter(point: LngLat, km = CCTV_MOVE_REFRESH_KM): LngLat {
  const step = km / 111;
  return {
    lng: Math.round(point.lng / step) * step,
    lat: Math.round(point.lat / step) * step,
  };
}

function quantizeHeading(heading: number) {
  return Math.round(heading / 15) * 15;
}

export function useCctvView({
  queryOrigin,
  headingDegrees,
  viewport,
  route,
  refreshNonce,
}: {
  queryOrigin: LngLat | null;
  headingDegrees: number;
  viewport: MapViewport | null;
  route: [number, number][];
  refreshNonce: number;
}) {
  const [catalog, setCatalog] = useState<CctvCamera[]>([]);
  const [origin, setOrigin] = useState<CctvDataOrigin>("snapshot");
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
  const heading = quantizeHeading(headingDegrees);

  useEffect(() => {
    const controller = new AbortController();
    void fetchCctvCatalog(refreshNonce > 0)
      .then((result) => {
        if (controller.signal.aborted) return;
        setCatalog(result.cameras);
        setOrigin(result.origin);
        setError(null);
      })
      .catch(() => {
        if (controller.signal.aborted) return;
        setCatalog([]);
        setOrigin("unavailable");
        setError("資料暫時無法取得");
      });
    return () => {
      controller.abort();
    };
  }, [refreshNonce]);

  const scored = useMemo(
    () =>
      catalog.length && searchCenter
        ? scoreCameras(catalog, searchCenter, heading, route)
        : [],
    [catalog, heading, route, searchCenter],
  );

  const preview = useMemo(() => previewCameras(scored), [scored]);
  const visible = useMemo(
    () => mapVisibleCameras(scored, viewport),
    [scored, viewport],
  );

  const cameraById = useCallback(
    (id: string) =>
      visible.find((camera) => camera.id === id) ??
      preview.find((camera) => camera.id === id) ??
      catalog.find((camera) => camera.id === id) ??
      null,
    [catalog, preview, visible],
  );

  const reload = useCallback(() => {
    void fetchCctvCatalog(true)
      .then((result) => {
        setCatalog(result.cameras);
        setOrigin(result.origin);
        setError(null);
      })
      .catch(() => {
        setCatalog([]);
        setOrigin("unavailable");
        setError("資料暫時無法取得");
      });
  }, []);

  return {
    origin,
    preview,
    visible,
    error,
    cameraById,
    reload,
  };
}
