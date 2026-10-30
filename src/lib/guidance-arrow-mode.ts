export type GuidanceArrowMode = "flat" | "float";

const STORAGE_KEY = "navpilot.guidance-arrow-mode.v1";
const CHANGE_EVENT = "navpilot-guidance-arrow-mode";

export function readGuidanceArrowMode(): GuidanceArrowMode {
  if (typeof window === "undefined") return "flat";
  try {
    const value = window.localStorage.getItem(STORAGE_KEY);
    if (value === "flat" || value === "float") return value;
  } catch {
    /* keep the on-road arrow */
  }
  return "flat";
}

export function getServerGuidanceArrowModeSnapshot(): GuidanceArrowMode {
  return "flat";
}

export function subscribeGuidanceArrowMode(onChange: () => void) {
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

export function writeGuidanceArrowMode(mode: GuidanceArrowMode) {
  try {
    window.localStorage.setItem(STORAGE_KEY, mode);
  } catch {
    /* ignore quota */
  }
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(CHANGE_EVENT));
  }
}
