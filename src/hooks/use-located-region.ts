"use client";

import { useEffect, useRef, useState } from "react";
import { distanceKm } from "@/lib/geo";
import type { LngLat } from "@/types/domain";

const REQUERY_KM = 2.4;

export function useLocatedRegion(point: LngLat) {
  const [city, setCity] = useState("");
  const lastQuery = useRef<LngLat | null>(null);

  useEffect(() => {
    if (
      lastQuery.current &&
      distanceKm(lastQuery.current, point) < REQUERY_KM
    ) {
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), 6_000);

    void fetch(
      `/api/region?lng=${encodeURIComponent(String(point.lng))}&lat=${encodeURIComponent(String(point.lat))}`,
      { signal: controller.signal, cache: "no-store" },
    )
      .then((response) => (response.ok ? response.json() : null))
      .then((payload: { city?: string } | null) => {
        if (typeof payload?.city === "string" && payload.city.trim()) {
          setCity(payload.city.trim());
          lastQuery.current = point;
        }
      })
      .catch(() => undefined)
      .finally(() => window.clearTimeout(timer));

    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [point.lat, point.lng]);

  return city;
}
