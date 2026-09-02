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
  GpsStatus,
  LngLat,
  MapViewport,
  VehiclePose,
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
  vehicle,
  gpsStatus,
  viewport,
  route,
  refreshNonce,
}: {
  vehicle: VehiclePose;
  gpsStatus: GpsStatus;
  viewport: MapViewport | null;
  route: [number, number][];
  refreshNonce: number;
}) {
  const [catalog, setCatalog] = useState<CctvCamera[]>([]);
  const [origin, setOrigin] = useState<CctvDataOrigin>("snapshot");
  const [error, setError] = useState<string | null>(null);

  const centerLng =
    gpsStatus === "active" ? vehicle.lng : (viewport?.center.lng ?? vehicle.lng);
  const centerLat =
    gpsStatus === "active" ? vehicle.lat : (viewport?.center.lat ?? vehicle.lat);
  const searchCenter = useMemo(
    () => quantizeCenter({ lng: centerLng, lat: centerLat }),
    [centerLat, centerLng],
  );
  const heading = quantizeHeading(vehicle.heading);

  useEffect(() => {
    let cancelled = false;
    void fetchCctvCatalog(refreshNonce > 0)
      .then((result) => {
        if (cancelled) return;
        setCatalog(result.cameras);
        setOrigin(result.origin);
        setError(null);
      })
      .catch(() => {
        if (!cancelled) setError("CCTV 資料載入失敗，已略過圖層。");
      });
    return () => {
      cancelled = true;
    };
  }, [refreshNonce]);

  const scored = useMemo(
    () =>
      catalog.length
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
        setError("CCTV 資料載入失敗，已略過圖層。");
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
