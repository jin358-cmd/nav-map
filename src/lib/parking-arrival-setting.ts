const STORAGE_KEY = "navpilot.parking-arrival-prompt.v1";
const CHANGE_EVENT = "navpilot-parking-arrival-prompt";

export function parkingArrivalPromptEnabled() {
  if (typeof window === "undefined") return true;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw == null) return true;
    return raw !== "0";
  } catch {
    return true;
  }
}

export function setParkingArrivalPromptEnabled(enabled: boolean) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, enabled ? "1" : "0");
    window.dispatchEvent(new Event(CHANGE_EVENT));
  } catch {
    /* ignore quota */
  }
}

export function subscribeParkingArrivalPrompt(onChange: () => void) {
  const handler = () => onChange();
  window.addEventListener(CHANGE_EVENT, handler);
  window.addEventListener("storage", handler);
  return () => {
    window.removeEventListener(CHANGE_EVENT, handler);
    window.removeEventListener("storage", handler);
  };
}
