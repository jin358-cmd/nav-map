"use client";

import { useEffect, useRef, useState } from "react";
import { distanceKm } from "@/lib/geo";
import type { SearchRegion } from "@/lib/poi-search";
import type { LngLat } from "@/types/domain";

const REQUERY_KM = 2.4;
const EMPTY_REGION: SearchRegion = { city: "", town: "" };

export function useLocatedRegion(point: LngLat | null) {
  const [region, setRegion] = useState<SearchRegion>(EMPTY_REGION);
  const lastQuery = useRef<LngLat | null>(null);
  const lng = point?.lng ?? null;
  const lat = point?.lat ?? null;

  useEffect(() => {
    if (lng == null || lat == null) return;
    const next = { lng, lat };
    if (
      lastQuery.current &&
      distanceKm(lastQuery.current, next) < REQUERY_KM
    ) {
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), 6_000);

    void fetch(
      `/api/region?lng=${encodeURIComponent(String(lng))}&lat=${encodeURIComponent(String(lat))}`,
      { signal: controller.signal, cache: "no-store" },
    )
      .then((response) => (response.ok ? response.json() : null))
      .then((payload: { city?: string; town?: string } | null) => {
        const city = typeof payload?.city === "string" ? payload.city.trim() : "";
        const town = typeof payload?.town === "string" ? payload.town.trim() : "";
        if (city) {
          setRegion({ city, town });
          lastQuery.current = next;
        }
      })
      .catch(() => undefined)
      .finally(() => window.clearTimeout(timer));

    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [lat, lng]);

  return region;
}
