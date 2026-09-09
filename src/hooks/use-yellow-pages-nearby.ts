"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { MapPoiFeature } from "@/lib/map-place";
import { distanceKm } from "@/lib/geo";
import type { ConvenienceKind } from "@/lib/poi/convenience-kind";
import type { EnergyKind } from "@/lib/poi/energy-kind";
import type { SearchShortcutId } from "@/lib/search-shortcuts";
import { searchShortcutById } from "@/lib/search-shortcuts";
import type { LngLat } from "@/types/domain";

export type NearbyShortcutPoi = MapPoiFeature & { distanceMeters: number };

function quantizeNearbyOrigin(origin: LngLat | null): LngLat | null {
  if (!origin) return null;
  const step = 0.0012;
  return {
    lng: Math.round(origin.lng / step) * step,
    lat: Math.round(origin.lat / step) * step,
  };
}

function nearbyRadiusMeters(
  shortcut: SearchShortcutId,
  energyKind: EnergyKind | null,
  convenienceKind: ConvenienceKind | null,
) {
  if (shortcut === "fuel") {
    if (energyKind === "gogoro" || energyKind === "tesla" || energyKind === "ev") {
      return 8000;
    }
    return 4200;
  }
  if (shortcut === "convenience") {
    if (convenienceKind === "shopee") return 4500;
    if (convenienceKind && convenienceKind !== "all") return 3200;
    return 2800;
  }
  return 2800;
}

export function useYellowPagesNearby({
  origin,
  shortcut,
  energyKind = null,
  convenienceKind = null,
}: {
  origin: LngLat | null;
  shortcut: SearchShortcutId | null;
  energyKind?: EnergyKind | null;
  convenienceKind?: ConvenienceKind | null;
}) {
  const [pois, setPois] = useState<NearbyShortcutPoi[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fetchedFor, setFetchedFor] = useState<string | null>(null);
  const originLng = origin?.lng ?? null;
  const originLat = origin?.lat ?? null;
  const bucket = useMemo(
    () =>
      originLng == null || originLat == null
        ? null
        : quantizeNearbyOrigin({ lng: originLng, lat: originLat }),
    [originLat, originLng],
  );
  const lng = bucket?.lng ?? null;
  const lat = bucket?.lat ?? null;
  const selected = searchShortcutById(shortcut);
  const selectedId = selected?.id ?? null;
  const resolvedEnergy = selectedId === "fuel" ? (energyKind ?? "petrol") : null;
  const resolvedConvenience =
    selectedId === "convenience" ? (convenienceKind ?? "all") : null;
  const fetchKey = selectedId
    ? `${selectedId}:${resolvedEnergy ?? ""}:${resolvedConvenience ?? ""}`
    : null;
  const ready = Boolean(selected && lng != null && lat != null);
  const fetchKeyRef = useRef<string | null>(null);

  useEffect(() => {
    if (!selected || lng == null || lat == null || !fetchKey) return;

    const shortcutChanged = fetchKeyRef.current !== fetchKey;
    fetchKeyRef.current = fetchKey;
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      if (shortcutChanged) setLoading(true);
      setError(null);
      const params = new URLSearchParams({
        nearby: "1",
        categories: selected.categories.join(","),
        lng: String(lng),
        lat: String(lat),
        radius: String(
          nearbyRadiusMeters(selected.id, resolvedEnergy, resolvedConvenience),
        ),
        limit: "14",
      });
      if (resolvedEnergy) params.set("energyKind", resolvedEnergy);
      if (resolvedConvenience) params.set("convenienceKind", resolvedConvenience);
      void fetch(`/api/pois?${params}`, { signal: controller.signal })
        .then(async (response) => {
          if (!response.ok) throw new Error("nearby failed");
          return response.json() as Promise<{ pois?: MapPoiFeature[] }>;
        })
        .then((data) => {
          if (controller.signal.aborted) return;
          const originFix = { lng, lat };
          setFetchedFor(fetchKey);
          setPois(
            (data.pois ?? []).map((poi) => ({
              ...poi,
              distanceMeters: Math.round(distanceKm(originFix, poi.location) * 1000),
            })),
          );
          setLoading(false);
        })
        .catch(() => {
          if (controller.signal.aborted) return;
          setFetchedFor(fetchKey);
          setLoading(false);
          setError("附近店家讀取失敗");
        });
    }, shortcutChanged ? 0 : 280);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [fetchKey, lat, lng, resolvedConvenience, resolvedEnergy, selected]);

  if (!ready || !fetchKey) {
    return { pois: [] as NearbyShortcutPoi[], loading: false, error: null };
  }
  const stale = fetchedFor !== fetchKey;
  return {
    pois: stale ? [] : pois,
    loading: stale || loading,
    error: stale ? null : error,
  };
}
