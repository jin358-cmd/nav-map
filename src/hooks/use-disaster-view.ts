"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { DISASTER_LIVE_CACHE_MS } from "@/lib/disaster-constants";
import type {
  DisasterAlert,
  DisasterCatalog,
  DisasterDataOrigin,
} from "@/types/domain";

async function fetchDisasterCatalog(force = false): Promise<DisasterCatalog> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), 12_000);
  try {
    const response = await fetch(
      force ? "/api/disasters?fresh=1" : "/api/disasters",
      { cache: "no-store", signal: controller.signal },
    );
    if (!response.ok) {
      throw new Error("disaster catalog failed");
    }
    const data = (await response.json()) as DisasterCatalog & {
      source?: string;
      updatedAt?: string;
      disasters?: DisasterCatalog["alerts"];
    };
    return {
      origin: data.origin,
      alerts: data.alerts ?? data.disasters ?? [],
      fetchedAt: data.fetchedAt ?? data.updatedAt ?? new Date().toISOString(),
    };
  } finally {
    window.clearTimeout(timer);
  }
}

export function useDisasterView(refreshNonce: number) {
  const [alerts, setAlerts] = useState<DisasterAlert[]>([]);
  const [origin, setOrigin] = useState<DisasterDataOrigin>("unavailable");
  const [error, setError] = useState<string | null>(null);

  const applyCatalog = useCallback((result: DisasterCatalog) => {
    setAlerts(result.alerts);
    setOrigin(result.origin);
    setError(null);
  }, []);

  useEffect(() => {
    let cancelled = false;
    void fetchDisasterCatalog(refreshNonce > 0)
      .then((result) => {
        if (!cancelled) applyCatalog(result);
      })
      .catch(() => {
        if (cancelled) return;
        setAlerts([]);
        setOrigin("unavailable");
        setError("資料暫時無法取得");
      });
    return () => {
      cancelled = true;
    };
  }, [applyCatalog, refreshNonce]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      void fetchDisasterCatalog(false)
        .then(applyCatalog)
        .catch(() => {
          setError("即時災害示警更新失敗，仍顯示上次資料。");
        });
    }, DISASTER_LIVE_CACHE_MS);
    return () => window.clearInterval(timer);
  }, [applyCatalog]);

  const reload = useCallback(() => {
    void fetchDisasterCatalog(true)
      .then(applyCatalog)
      .catch(() => {
        setAlerts([]);
        setOrigin("unavailable");
        setError("資料暫時無法取得");
      });
  }, [applyCatalog]);

  return useMemo(
    () => ({ alerts, origin, error, reload }),
    [alerts, error, origin, reload],
  );
}
