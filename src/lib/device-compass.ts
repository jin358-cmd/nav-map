/** Presentation-only compass heading. Does not write GPS / watchPosition. */

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

export function subscribeDeviceCompass(onHeading: (heading: number) => void): () => void {
  if (typeof window === "undefined") return () => undefined;

  const onOrient = (event: Event) => {
    const heading = readDeviceCompassHeading(event as DeviceOrientationEvent);
    if (heading == null) return;
    onHeading(heading);
  };

  const listen = () => {
    window.addEventListener("deviceorientationabsolute", onOrient, true);
    window.addEventListener("deviceorientation", onOrient, true);
  };

  const DOE = window.DeviceOrientationEvent as unknown as {
    requestPermission?: () => Promise<string>;
  };
  if (typeof DOE.requestPermission === "function") {
    void DOE.requestPermission()
      .then((state) => {
        if (state === "granted") listen();
      })
      .catch(() => {
        listen();
      });
  } else {
    listen();
  }

  return () => {
    window.removeEventListener("deviceorientationabsolute", onOrient, true);
    window.removeEventListener("deviceorientation", onOrient, true);
  };
}
