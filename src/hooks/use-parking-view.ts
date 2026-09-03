"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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
  const [catalog, setCatalog] = useState<ParkingCatalog>({
    origin: "unavailable",
    lots: [],
    fetchedAt: "",
  });
  const [error, setError] = useState<string | null>(null);
  const generationRef = useRef(0);

  const quantized = useMemo(() => {
    if (!center) return null;
    return {
      lat: Math.round(center.lat * 200) / 200,
      lng: Math.round(center.lng * 200) / 200,
    };
  }, [center]);

  useEffect(() => {
    if (!enabled || !quantized) return;
    const generation = generationRef.current + 1;
    generationRef.current = generation;
    const controller = new AbortController();
    void fetchParking(quantized, radiusKm, controller.signal)
      .then((next) => {
        if (generation !== generationRef.current) return;
        setCatalog(next);
        setError(next.origin === "unavailable" ? "資料暫時無法取得" : null);
      })
      .catch((caught: unknown) => {
        if (generation !== generationRef.current) return;
        if (caught instanceof DOMException && caught.name === "AbortError") return;
        setCatalog({
          origin: "unavailable",
          lots: [],
          fetchedAt: new Date().toISOString(),
        });
        setError("資料暫時無法取得");
      });
    return () => {
      controller.abort();
    };
  }, [enabled, quantized, radiusKm]);

  const lots: ParkingLot[] = enabled ? catalog.lots : [];

  return {
    lots,
    origin: catalog.origin,
    error: enabled ? error : null,
    fetchedAt: catalog.fetchedAt || null,
    reload: () => {
      generationRef.current += 1;
    },
  };
}
