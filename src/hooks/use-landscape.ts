"use client";

import { useSyncExternalStore } from "react";

function isLandscapeViewport() {
  return window.innerWidth > window.innerHeight;
}

function subscribe(onChange: () => void) {
  const media = window.matchMedia("(orientation: landscape)");
  media.addEventListener("change", onChange);
  window.addEventListener("resize", onChange);
  return () => {
    media.removeEventListener("change", onChange);
    window.removeEventListener("resize", onChange);
  };
}

export function useLandscape() {
  return useSyncExternalStore(subscribe, isLandscapeViewport, () => false);
}
