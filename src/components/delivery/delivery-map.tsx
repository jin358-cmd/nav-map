"use client";

import { useEffect, useRef } from "react";
import { LngLatBounds, Map as MapLibreMap } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { basemapStyle } from "@/lib/map-basemap";
import { syncDeliveryMarkers } from "@/lib/delivery-layer";
import { configureMapLibreWorker } from "@/lib/maplibre-worker";
import { TAINAN_CENTER } from "@/lib/constants";
import type { DeliveryMapPin } from "@/lib/delivery/types";

export function DeliveryMap({ pins }: { pins: DeliveryMapPin[] }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const pinsRef = useRef(pins);
  const roles = pins
    .map((pin) => pin.role)
    .sort()
    .join(",");

  useEffect(() => {
    const host = hostRef.current;
    if (!host || mapRef.current) return;
    configureMapLibreWorker();
    const map = new MapLibreMap({
      container: host,
      style: basemapStyle("dark"),
      center: [TAINAN_CENTER.lng, TAINAN_CENTER.lat],
      zoom: 13,
      attributionControl: false,
    });
    mapRef.current = map;
    const paint = () => {
      map.resize();
      syncDeliveryMarkers(map, pinsRef.current);
      fitDeliveryPins(map, pinsRef.current);
      host.dataset.mapReady = "1";
    };
    if (map.isStyleLoaded()) paint();
    else map.once("load", paint);
    const observer = new ResizeObserver(() => {
      map.resize();
    });
    observer.observe(host);
    return () => {
      observer.disconnect();
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    pinsRef.current = pins;
    const map = mapRef.current;
    if (!map?.isStyleLoaded()) return;
    syncDeliveryMarkers(map, pins);
  }, [pins]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map?.isStyleLoaded()) return;
    fitDeliveryPins(map, pinsRef.current);
  }, [roles]);

  return <div ref={hostRef} className="h-full min-h-48 w-full" data-testid="delivery-map" />;
}

function fitDeliveryPins(map: MapLibreMap, pins: DeliveryMapPin[]) {
  if (pins.length === 0) return;
  if (pins.length === 1) {
    map.easeTo({ center: [pins[0].lng, pins[0].lat], zoom: Math.max(map.getZoom(), 14), duration: 400 });
    return;
  }
  const bounds = new LngLatBounds();
  for (const pin of pins) bounds.extend([pin.lng, pin.lat]);
  map.fitBounds(bounds, { padding: 48, maxZoom: 15.5, duration: 400 });
}
