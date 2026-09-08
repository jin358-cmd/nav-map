/** Presentation-only compass heading. Does not write GPS / watchPosition. */

import { damp, headingDelta, lerpAngle } from "@/lib/geo";

export function readDeviceCompassHeading(event: DeviceOrientationEvent): number | null {
  const webkit = (event as DeviceOrientationEvent & { webkitCompassHeading?: number })
    .webkitCompassHeading;
  if (typeof webkit === "number" && Number.isFinite(webkit)) {
    return (webkit + 360) % 360;
  }
  if (typeof event.alpha === "number" && Number.isFinite(event.alpha)) {
    return (360 - event.alpha + 360) % 360;
  }
  return null;
}

export async function requestDeviceCompassPermission() {
  if (typeof window === "undefined") return;
  const DOE = window.DeviceOrientationEvent as unknown as {
    requestPermission?: () => Promise<string>;
  };
  if (typeof DOE.requestPermission !== "function") return;
  try {
    await DOE.requestPermission();
  } catch {
    /* permission prompt is best-effort */
  }
}

export function subscribeDeviceCompass(onHeading: (heading: number) => void): () => void {
  if (typeof window === "undefined") return () => undefined;

  let sawAbsolute = false;
  let smoothed: number | null = null;
  let lastAt = 0;

  const emit = (event: DeviceOrientationEvent, fromAbsolute: boolean) => {
    if (fromAbsolute) sawAbsolute = true;
    else if (sawAbsolute) return;
    const heading = readDeviceCompassHeading(event);
    if (heading == null) return;
    const now = performance.now();
    const dt = lastAt === 0 ? 0.05 : Math.min(0.25, (now - lastAt) / 1000);
    lastAt = now;
    if (smoothed == null) {
      smoothed = heading;
      onHeading(smoothed);
      return;
    }
    const jump = headingDelta(smoothed, heading);
    if (jump > 75) return;
    smoothed = lerpAngle(smoothed, heading, damp(dt, 0.38));
    onHeading(smoothed);
  };

  const onAbsolute = (event: Event) => {
    emit(event as DeviceOrientationEvent, true);
  };
  const onRelative = (event: Event) => {
    const next = event as DeviceOrientationEvent;
    emit(next, next.absolute === true);
  };

  window.addEventListener("deviceorientationabsolute", onAbsolute, true);
  window.addEventListener("deviceorientation", onRelative, true);
  void requestDeviceCompassPermission();

  return () => {
    window.removeEventListener("deviceorientationabsolute", onAbsolute, true);
    window.removeEventListener("deviceorientation", onRelative, true);
  };
}
