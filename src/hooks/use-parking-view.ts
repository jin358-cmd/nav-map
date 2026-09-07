"use client";

import { useEffect, useRef, useState } from "react";
import { PARKING_DEFAULT_RADIUS_M } from "@/lib/parking/constants";
import type { LngLat, ParkingCatalog, ParkingLot } from "@/types/domain";

function normalizeLot(lot: ParkingLot): ParkingLot {
  return {
    ...lot,
    feeClass: lot.feeClass ?? "unknown",
    publicLot: lot.publicLot ?? true,
    brand: lot.brand ?? null,
    registered: lot.registered ?? false,
    hourlyRate: lot.hourlyRate ?? null,
    dailyMax: lot.dailyMax ?? null,
    availabilityStatus: lot.availabilityStatus ?? "unknown",
  };
}

async function fetchParking(
  center: LngLat,
  radiusMeters: number,
  signal: AbortSignal,
): Promise<ParkingCatalog> {
  const params = new URLSearchParams({
    lat: String(center.lat),
    lng: String(center.lng),
    radius: String(radiusMeters),
  });
  const response = await fetch(`/api/parking/nearby?${params.toString()}`, {
    cache: "no-store",
    signal,
  });
  if (!response.ok) throw new Error("parking nearby failed");
  const data = (await response.json()) as ParkingCatalog;
  return {
    origin: data.origin ?? "unavailable",
    lots: (data.lots ?? []).map(normalizeLot),
    fetchedAt: data.fetchedAt ?? new Date().toISOString(),
  };
}

export function useParkingView({
  center,
  enabled,
  radiusMeters = PARKING_DEFAULT_RADIUS_M,
  refreshMs = 0,
}: {
  center: LngLat | null;
  enabled: boolean;
  radiusMeters?: number;
  refreshMs?: number;
}) {
  const [catalog, setCatalog] = useState<ParkingCatalog>({
    origin: "unavailable",
    lots: [],
    fetchedAt: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const generationRef = useRef(0);
  const hasLotsRef = useRef(false);

  const searchLng = center ? Number((Math.round(center.lng * 200) / 200).toFixed(5)) : null;
  const searchLat = center ? Number((Math.round(center.lat * 200) / 200).toFixed(5)) : null;
  const requestKey =
    searchLng == null || searchLat == null
      ? null
      : `${searchLng.toFixed(5)}:${searchLat.toFixed(5)}:${radiusMeters}`;

  useEffect(() => {
    if (!enabled || searchLng == null || searchLat == null || requestKey == null) {
      return;
    }
    const generation = generationRef.current + 1;
    generationRef.current = generation;
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setLoading(true);
      void fetchParking(
        { lng: searchLng, lat: searchLat },
        radiusMeters,
        controller.signal,
      )
        .then((next) => {
          if (generation !== generationRef.current) return;
          setCatalog(next);
          hasLotsRef.current = next.lots.length > 0;
          setError(next.origin === "unavailable" ? "資料暫時無法取得" : null);
          setLoading(false);
        })
        .catch((caught: unknown) => {
          if (generation !== generationRef.current) return;
          if (caught instanceof DOMException && caught.name === "AbortError") return;
          setCatalog({
            origin: "unavailable",
            lots: [],
            fetchedAt: new Date().toISOString(),
          });
          hasLotsRef.current = false;
          setError("資料暫時無法取得");
          setLoading(false);
        });
    }, 400);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [enabled, radiusMeters, requestKey, searchLat, searchLng]);

  useEffect(() => {
    if (
      !enabled ||
      refreshMs <= 0 ||
      searchLng == null ||
      searchLat == null ||
      requestKey == null
    ) {
      return;
    }
    let cancelled = false;
    let controller = new AbortController();

    const run = () => {
      controller.abort();
      controller = new AbortController();
      const generation = generationRef.current + 1;
      generationRef.current = generation;
      const signal = controller.signal;
      void fetchParking(
        { lng: searchLng, lat: searchLat },
        radiusMeters,
        signal,
      )
        .then((next) => {
          if (cancelled || generation !== generationRef.current) return;
          setCatalog(next);
          hasLotsRef.current = next.lots.length > 0;
          setError(next.origin === "unavailable" ? "資料暫時無法取得" : null);
          setLoading(false);
        })
        .catch((caught: unknown) => {
          if (cancelled || generation !== generationRef.current) return;
          if (caught instanceof DOMException && caught.name === "AbortError") return;
          if (hasLotsRef.current) {
            setLoading(false);
            return;
          }
          setCatalog({
            origin: "unavailable",
            lots: [],
            fetchedAt: new Date().toISOString(),
          });
          hasLotsRef.current = false;
          setError("資料暫時無法取得");
          setLoading(false);
        });
    };

    run();
    const interval = window.setInterval(run, refreshMs);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
      controller.abort();
    };
  }, [enabled, radiusMeters, refreshMs, requestKey, searchLat, searchLng]);

  return {
    lots: catalog.lots,
    origin: catalog.origin,
    error: enabled ? error : null,
    fetchedAt: catalog.fetchedAt || null,
    loading: enabled && loading,
    reload: () => {
      generationRef.current += 1;
    },
  };
}
