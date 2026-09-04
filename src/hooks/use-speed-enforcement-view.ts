"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  SPEED_ENFORCEMENT_CLIENT_CACHE_MS,
  SPEED_ENFORCEMENT_MOVE_DEBOUNCE_MS,
} from "@/lib/speed-enforcement-constants";
import type {
  LngLat,
  MapViewport,
  SpeedEnforcementCatalog,
  SpeedEnforcementPoint,
} from "@/types/domain";

const inflightKeys = new Set<string>();
const successCache = new Map<
  string,
  { at: number; points: SpeedEnforcementPoint[] }
>();

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

function isAbortError(reason: unknown) {
  return reason instanceof DOMException && reason.name === "AbortError";
}

async function fetchSpeedEnforcement(
  center: LngLat,
  radiusMeters: number,
  force: boolean,
  signal: AbortSignal,
): Promise<SpeedEnforcementCatalog> {
  const params = new URLSearchParams({
    lng: String(center.lng),
    lat: String(center.lat),
    radius: String(radiusMeters),
  });
  if (force) params.set("fresh", "1");

  const timeout = new AbortController();
  const timer = window.setTimeout(() => timeout.abort(), 30_000);
  const onAbort = () => timeout.abort();
  if (signal.aborted) timeout.abort();
  else signal.addEventListener("abort", onAbort, { once: true });

  try {
    const response = await fetch(`/api/speed-enforcement?${params}`, {
      cache: "no-store",
      signal: timeout.signal,
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
    signal.removeEventListener("abort", onAbort);
  }
}

export function useSpeedEnforcementView({
  searchOrigin,
  viewport,
  refreshNonce,
}: {
  searchOrigin: LngLat | null;
  viewport: MapViewport | null;
  refreshNonce: number;
}) {
  const [points, setPoints] = useState<SpeedEnforcementPoint[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);
  const handledNonceRef = useRef(0);
  const handledReloadRef = useRef(0);
  const zoom = viewport?.zoom ?? 15;
  const radiusMeters = radiusForZoom(zoom);
  const quantized = searchOrigin
    ? quantizeCenter(searchOrigin, radiusMeters)
    : null;
  const searchLng =
    quantized == null ? null : Number(quantized.lng.toFixed(5));
  const searchLat =
    quantized == null ? null : Number(quantized.lat.toFixed(5));
  const requestKey =
    searchLng == null || searchLat == null
      ? null
      : `${searchLng.toFixed(5)}:${searchLat.toFixed(5)}:${radiusMeters}`;

  const cachedEntry = requestKey ? successCache.get(requestKey) : undefined;

  useEffect(() => {
    if (searchLng == null || searchLat == null || requestKey == null) {
      return;
    }

    const force =
      refreshNonce > handledNonceRef.current ||
      reloadToken > handledReloadRef.current;
    if (!force) {
      const cached = successCache.get(requestKey);
      if (
        cached &&
        Date.now() - cached.at < SPEED_ENFORCEMENT_CLIENT_CACHE_MS
      ) {
        return;
      }
      if (inflightKeys.has(requestKey)) return;
    } else if (inflightKeys.has(requestKey)) {
      return;
    }

    const controller = new AbortController();
    const delay = force ? 0 : SPEED_ENFORCEMENT_MOVE_DEBOUNCE_MS;
    let started = false;
    const timer = window.setTimeout(() => {
      if (controller.signal.aborted) return;
      if (inflightKeys.has(requestKey)) return;
      started = true;
      inflightKeys.add(requestKey);
      void fetchSpeedEnforcement(
        { lng: searchLng, lat: searchLat },
        radiusMeters,
        force,
        controller.signal,
      )
        .then((catalog) => {
          if (controller.signal.aborted) return;
          successCache.set(requestKey, {
            at: Date.now(),
            points: catalog.points,
          });
          handledNonceRef.current = refreshNonce;
          handledReloadRef.current = reloadToken;
          setPoints(catalog.points);
          setError(null);
        })
        .catch((reason: unknown) => {
          if (controller.signal.aborted || isAbortError(reason)) return;
          setPoints([]);
          setError(
            reason instanceof Error
              ? reason.message
              : "測速執法公開資料載入失敗",
          );
        })
        .finally(() => {
          inflightKeys.delete(requestKey);
        });
    }, delay);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
      if (started) inflightKeys.delete(requestKey);
    };
  }, [radiusMeters, refreshNonce, reloadToken, requestKey, searchLat, searchLng]);

  const reload = useCallback(() => {
    setReloadToken((value) => value + 1);
  }, []);

  return {
    points: cachedEntry?.points ?? points,
    error,
    reload,
  };
}
