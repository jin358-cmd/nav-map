const STORAGE_KEY = "navpilot.nav-auto-zoom.v1";
const CHANGE_EVENT = "navpilot-nav-auto-zoom";

export function readNavAutoZoomEnabled() {
  if (typeof window === "undefined") return true;
  try {
    const value = window.localStorage.getItem(STORAGE_KEY);
    if (value == null) return true;
    return value !== "0";
  } catch {
    return true;
  }
}

export function getServerNavAutoZoomSnapshot() {
  return true;
}

export function subscribeNavAutoZoom(onChange: () => void) {
  if (typeof window === "undefined") return () => undefined;
  const onStorage = (event: StorageEvent) => {
    if (event.key === STORAGE_KEY) onChange();
  };
  window.addEventListener("storage", onStorage);
  window.addEventListener(CHANGE_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(CHANGE_EVENT, onChange);
  };
}

export function writeNavAutoZoomEnabled(enabled: boolean) {
  try {
    window.localStorage.setItem(STORAGE_KEY, enabled ? "1" : "0");
  } catch {
    /* ignore quota */
  }
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(CHANGE_EVENT));
  }
}
