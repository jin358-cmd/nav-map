"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type {
  LngLat,
  MapViewport,
  SpeedEnforcementCatalog,
  SpeedEnforcementPoint,
  VehiclePose,
} from "@/types/domain";

function radiusForZoom(zoom: number) {
  if (zoom >= 15) return 3_000;
  if (zoom >= 13) return 6_000;
  return 10_000;
}

function quantizeCenter(point: LngLat, radiusMeters: number): LngLat {
  const step = Math.max(0.01, (radiusMeters * 0.4) / 111_000);
  return {
    lng: Math.round(point.lng / step) * step,
    lat: Math.round(point.lat / step) * step,
  };
}

async function fetchSpeedEnforcement(
  center: LngLat,
  radiusMeters: number,
  force: boolean,
): Promise<SpeedEnforcementCatalog> {
  const params = new URLSearchParams({
    lng: String(center.lng),
    lat: String(center.lat),
    radius: String(radiusMeters),
  });
  if (force) params.set("fresh", "1");

  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), 30_000);
  try {
    const response = await fetch(`/api/speed-enforcement?${params}`, {
      cache: "no-store",
      signal: controller.signal,
    });
    const data = (await response.json()) as SpeedEnforcementCatalog & {
      error?: string;
    };
    if (!response.ok) {
      throw new Error(data.error || "測速執法公開資料載入失敗");
    }
    return data;
  } finally {
    window.clearTimeout(timer);
  }
}

export function useSpeedEnforcementView({
  vehicle,
  viewport,
  refreshNonce,
}: {
  vehicle: VehiclePose;
  viewport: MapViewport | null;
  refreshNonce: number;
}) {
  const [points, setPoints] = useState<SpeedEnforcementPoint[]>([]);
  const [error, setError] = useState<string | null>(null);
  const centerLng = viewport?.center.lng ?? vehicle.lng;
  const centerLat = viewport?.center.lat ?? vehicle.lat;
  const zoom = viewport?.zoom ?? 15;
  const radiusMeters = radiusForZoom(zoom);
  const searchCenter = useMemo(
    () => quantizeCenter({ lng: centerLng, lat: centerLat }, radiusMeters),
    [centerLat, centerLng, radiusMeters],
  );

  const load = useCallback(
    async (force = false) => {
      const catalog = await fetchSpeedEnforcement(
        searchCenter,
        radiusMeters,
        force,
      );
      setPoints(catalog.points);
      setError(null);
    },
    [radiusMeters, searchCenter],
  );

  useEffect(() => {
    let cancelled = false;
    void fetchSpeedEnforcement(searchCenter, radiusMeters, false)
      .then((catalog) => {
        if (cancelled) return;
        setPoints(catalog.points);
        setError(null);
      })
      .catch((reason: unknown) => {
        if (cancelled) return;
        setPoints([]);
        setError(
          reason instanceof Error
            ? reason.message
            : "測速執法公開資料載入失敗",
        );
      });
    return () => {
      cancelled = true;
    };
  }, [radiusMeters, refreshNonce, searchCenter]);

  const reload = useCallback(() => {
    void load(true).catch((reason: unknown) => {
      setError(
        reason instanceof Error
          ? reason.message
          : "測速執法公開資料載入失敗",
      );
    });
  }, [load]);

  return { points, error, reload };
}
