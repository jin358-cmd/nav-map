"use client";

import { useSyncExternalStore } from "react";

const QUERY = "(orientation: landscape)";

function subscribe(onChange: () => void) {
  const media = window.matchMedia(QUERY);
  media.addEventListener("change", onChange);
  return () => media.removeEventListener("change", onChange);
}

function getSnapshot() {
  return window.matchMedia(QUERY).matches;
}

export function useLandscape() {
  return useSyncExternalStore(subscribe, getSnapshot, () => false);
}
