"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { LngLat, ParkingCatalog, ParkingLot } from "@/types/domain";

async function fetchParking(
  center: LngLat,
  radiusKm: number,
  signal: AbortSignal,
): Promise<ParkingCatalog> {
  const params = new URLSearchParams({
    lat: String(center.lat),
    lng: String(center.lng),
    radiusKm: String(radiusKm),
  });
  const response = await fetch(`/api/parking?${params.toString()}`, {
    cache: "no-store",
    signal,
  });
  if (!response.ok) throw new Error("parking catalog failed");
  const data = (await response.json()) as ParkingCatalog;
  return {
    origin: data.origin ?? "unavailable",
    lots: data.lots ?? [],
    fetchedAt: data.fetchedAt ?? new Date().toISOString(),
  };
}

export function useParkingView({
  center,
  enabled,
  radiusKm = 4,
}: {
  center: LngLat | null;
  enabled: boolean;
  radiusKm?: number;
}) {
  const [lots, setLots] = useState<ParkingLot[]>([]);
  const [origin, setOrigin] = useState<ParkingCatalog["origin"]>("unavailable");
  const [error, setError] = useState<string | null>(null);
  const [fetchedAt, setFetchedAt] = useState<string | null>(null);
  const generationRef = useRef(0);

  const quantized = useMemo(() => {
    if (!center) return null;
    return {
      lat: Math.round(center.lat * 200) / 200,
      lng: Math.round(center.lng * 200) / 200,
    };
  }, [center]);

  const load = useCallback(() => {
    if (!enabled || !quantized) {
      setLots([]);
      return;
    }
    const generation = generationRef.current + 1;
    generationRef.current = generation;
    const controller = new AbortController();
    void fetchParking(quantized, radiusKm, controller.signal)
      .then((catalog) => {
        if (generation !== generationRef.current) return;
        setLots(catalog.lots);
        setOrigin(catalog.origin);
        setFetchedAt(catalog.fetchedAt);
        setError(catalog.origin === "unavailable" ? "資料暫時無法取得" : null);
      })
      .catch((error: unknown) => {
        if (generation !== generationRef.current) return;
        if (error instanceof DOMException && error.name === "AbortError") return;
        setLots([]);
        setOrigin("unavailable");
        setError("資料暫時無法取得");
      });
    return () => {
      controller.abort();
    };
  }, [enabled, quantized, radiusKm]);

  useEffect(() => {
    const stop = load();
    return () => stop?.();
  }, [load]);

  return { lots, origin, error, fetchedAt, reload: load };
}
