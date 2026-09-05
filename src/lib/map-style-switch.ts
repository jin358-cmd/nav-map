import type { Map as MapLibreMap } from "maplibre-gl";
import { detectAppliedBasemap } from "@/lib/map-basemap";

export function isLiveStyleGeneration(latest: number, generation: number) {
  return latest === generation;
}

export function isStaleStyleError(error: unknown) {
  return error instanceof Error && error.message === "stale-style-load";
}

function styleIsUsable(map: MapLibreMap) {
  try {
    return map.isStyleLoaded();
  } catch {
    return false;
  }
}

function errorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  if (error && typeof error === "object" && "message" in error) {
    const value = (error as { message?: unknown }).message;
    return typeof value === "string" ? value : "";
  }
  return "";
}

export function waitForBasemapStyle(
  map: MapLibreMap,
  isCurrent: () => boolean,
  expected: "light" | "dark" | "satellite",
  timeoutMs = 14000,
): { promise: Promise<void>; cancel: () => void } {
  let settled = false;
  let timer = 0;
  let poll = 0;
  let fulfill: (error?: Error) => void = () => undefined;

  function matchesExpected() {
    const kind = detectAppliedBasemap(map);
    return kind === expected;
  }

  function trySettle() {
    if (settled) return;
    if (!isCurrent()) {
      fulfill(new Error("stale-style-load"));
      return;
    }
    if (!styleIsUsable(map) || !matchesExpected()) return;
    fulfill();
  }

  function onIdle() {
    trySettle();
  }

  function onStyleLoad() {
    if (!isCurrent()) {
      fulfill(new Error("stale-style-load"));
      return;
    }
    requestAnimationFrame(() => {
      if (settled) return;
      trySettle();
      if (!settled) map.once("idle", onIdle);
    });
  }

  function onStyleData() {
    trySettle();
  }

  function onError(event: { error?: unknown; sourceId?: string }) {
    if (settled || event.sourceId) return;
    const message = errorMessage(event.error);
    if (!/failed to (load|fetch) style|stylesheet|style.json/i.test(message)) {
      return;
    }
    if (!isCurrent()) {
      fulfill(new Error("stale-style-load"));
      return;
    }
    fulfill(new Error(message || "style-error"));
  }

  const promise = new Promise<void>((resolve, reject) => {
    fulfill = (error?: Error) => {
      if (settled) return;
      settled = true;
      map.off("style.load", onStyleLoad);
      map.off("styledata", onStyleData);
      map.off("idle", onIdle);
      map.off("error", onError);
      window.clearTimeout(timer);
      window.clearInterval(poll);
      if (error) reject(error);
      else resolve();
    };

    timer = window.setTimeout(() => {
      fulfill(new Error("style-timeout"));
    }, timeoutMs);

    map.on("style.load", onStyleLoad);
    map.on("styledata", onStyleData);
    map.on("idle", onIdle);
    map.on("error", onError);
    poll = window.setInterval(trySettle, 200);
  });

  return {
    promise,
    cancel() {
      fulfill(new Error("stale-style-load"));
    },
  };
}
