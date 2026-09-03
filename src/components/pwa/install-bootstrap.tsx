"use client";

import { useEffect } from "react";

const DEV_SW_CLEARED_KEY = "navpilot.dev.sw-cleared";

export function InstallBootstrap() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    if (process.env.NODE_ENV !== "production") {
      void navigator.serviceWorker.getRegistrations().then(async (registrations) => {
        if (registrations.length === 0) return;
        await Promise.all(registrations.map((registration) => registration.unregister()));
        try {
          if (sessionStorage.getItem(DEV_SW_CLEARED_KEY)) return;
          sessionStorage.setItem(DEV_SW_CLEARED_KEY, "1");
        } catch {
          return;
        }
        window.location.reload();
      });
      return;
    }

    const register = () => {
      void navigator.serviceWorker.register("/sw.js").catch(() => undefined);
    };
    if (document.readyState === "complete") register();
    else window.addEventListener("load", register, { once: true });
  }, []);

  return null;
}
