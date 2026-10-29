"use client";

import { useEffect, useMemo, useState } from "react";
import { distanceToRouteMeters } from "@/lib/traffic-signals/project.mjs";
import type { TrafficSignalView } from "@/components/overlay/traffic-signal-card";
import type { MapViewport } from "@/types/domain";

type Catalog = {
  signals: TrafficSignalView[];
  attribution: string | null;
};

const EMPTY: Catalog = { signals: [], attribution: null };

export function useTrafficSignals(
  viewport: MapViewport | null,
  route: [number, number][],
  navigating: boolean,
  enabled: boolean,
) {
  const [catalog, setCatalog] = useState<Catalog>(EMPTY);
  const bounds = viewport?.bounds;
  const zoom = viewport?.zoom ?? 0;
  const key = bounds
    ? [
        zoom.toFixed(2),
        bounds.west.toFixed(4),
        bounds.south.toFixed(4),
        bounds.east.toFixed(4),
        bounds.north.toFixed(4),
        enabled ? "1" : "0",
      ].join(",")
    : "";

  useEffect(() => {
    if (!enabled || !bounds || zoom < 14) return;
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      const params = new URLSearchParams({
        west: String(bounds.west),
        south: String(bounds.south),
        east: String(bounds.east),
        north: String(bounds.north),
        zoom: String(zoom),
        centerLng: String(viewport?.center.lng ?? ""),
        centerLat: String(viewport?.center.lat ?? ""),
      });
      void fetch(`/api/traffic-signals?${params.toString()}`, { signal: controller.signal })
        .then((response) => (response.ok ? response.json() : null))
        .then((body) => {
          if (!body || controller.signal.aborted) return;
          setCatalog({
            signals: Array.isArray(body.signals) ? body.signals : [],
            attribution: typeof body.attribution === "string" ? body.attribution : null,
          });
        })
        .catch(() => {
          if (!controller.signal.aborted) setCatalog(EMPTY);
        });
    }, 350);
    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [bounds, enabled, key, viewport?.center.lat, viewport?.center.lng, zoom]);

  const signals = useMemo(() => {
    if (!enabled || zoom < 14) return [];
    if (!navigating || route.length < 2) return catalog.signals;
    return catalog.signals.filter(
      (signal) => distanceToRouteMeters(signal.location, route) <= 120,
    );
  }, [catalog.signals, enabled, navigating, route, zoom]);

  return { signals, attribution: catalog.attribution };
}
