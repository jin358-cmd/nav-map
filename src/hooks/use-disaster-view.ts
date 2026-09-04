"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { DISASTER_LIVE_CACHE_MS } from "@/lib/disaster-constants";
import type {
  DisasterAlert,
  DisasterCatalog,
  DisasterDataOrigin,
} from "@/types/domain";

const inflightKeys = new Set<string>();

async function fetchDisasterCatalog(
  force = false,
  external?: AbortSignal,
): Promise<DisasterCatalog> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), 12_000);
  const onAbort = () => controller.abort();
  if (external?.aborted) controller.abort();
  else external?.addEventListener("abort", onAbort, { once: true });
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
    external?.removeEventListener("abort", onAbort);
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
    const requestKey = refreshNonce > 0 ? "disasters:fresh" : "disasters:live";
    if (inflightKeys.has(requestKey)) return;
    const controller = new AbortController();
    inflightKeys.add(requestKey);
    void fetchDisasterCatalog(refreshNonce > 0, controller.signal)
      .then((result) => {
        if (controller.signal.aborted) return;
        applyCatalog(result);
      })
      .catch(() => {
        if (controller.signal.aborted) return;
        setAlerts([]);
        setOrigin("unavailable");
        setError("資料暫時無法取得");
      })
      .finally(() => {
        inflightKeys.delete(requestKey);
      });
    return () => {
      controller.abort();
      inflightKeys.delete(requestKey);
    };
  }, [applyCatalog, refreshNonce]);

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setInterval(() => {
      if (inflightKeys.has("disasters:live")) return;
      inflightKeys.add("disasters:live");
      void fetchDisasterCatalog(false, controller.signal)
        .then((result) => {
          if (!controller.signal.aborted) applyCatalog(result);
        })
        .catch(() => {
          if (!controller.signal.aborted) {
            setError("即時災害示警更新失敗，仍顯示上次資料。");
          }
        })
        .finally(() => {
          inflightKeys.delete("disasters:live");
        });
    }, DISASTER_LIVE_CACHE_MS);
    return () => {
      window.clearInterval(timer);
      controller.abort();
    };
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
