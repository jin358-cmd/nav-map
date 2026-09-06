"use client";

import { useEffect, useRef, useState } from "react";
import { PARKING_DEFAULT_RADIUS_M } from "@/lib/parking/constants";
import type { LngLat, ParkingCatalog, ParkingLot } from "@/types/domain";

function normalizeLot(lot: ParkingLot): ParkingLot {
  return {
    ...lot,
    feeClass: lot.feeClass ?? "unknown",
    publicLot: lot.publicLot ?? true,
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
}: {
  center: LngLat | null;
  enabled: boolean;
  radiusMeters?: number;
}) {
  const [catalog, setCatalog] = useState<ParkingCatalog>({
    origin: "unavailable",
    lots: [],
    fetchedAt: "",
  });
  const [error, setError] = useState<string | null>(null);
  const generationRef = useRef(0);

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
      void fetchParking(
        { lng: searchLng, lat: searchLat },
        radiusMeters,
        controller.signal,
      )
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
    }, 400);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [enabled, radiusMeters, requestKey, searchLat, searchLng]);

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
