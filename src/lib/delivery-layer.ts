import { Marker, type Map as MapLibreMap } from "maplibre-gl";
import type { DeliveryMapPin } from "@/lib/delivery/types";

const buckets = new WeakMap<MapLibreMap, Marker[]>();

const GLYPH: Record<DeliveryMapPin["role"], string> = {
  courier: "送",
  dropoff: "收",
  pickup: "店",
  customer: "客",
};

export function syncDeliveryMarkers(map: MapLibreMap, pins: DeliveryMapPin[]) {
  const previous = buckets.get(map) ?? [];
  for (const marker of previous) marker.remove();
  const next: Marker[] = [];
  for (const pin of pins) {
    const element = document.createElement("div");
    element.className = `delivery-pin delivery-pin--${pin.role}`;
    element.title = pin.label;
    element.textContent = GLYPH[pin.role];
    next.push(
      new Marker({ element, anchor: "center" }).setLngLat([pin.lng, pin.lat]).addTo(map),
    );
  }
  buckets.set(map, next);
}
