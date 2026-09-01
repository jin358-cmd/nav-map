"use client";

import { useEffect, useRef } from "react";
import { Map as MapLibreMap, Marker } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { createVehicleMarkerElement } from "@/components/map/vehicle-marker";
import {
  DRIVING_PADDING_RATIO,
  DRIVING_PITCH,
  DRIVING_ZOOM,
  OPENFREEMAP_DARK_STYLE,
  OVERHEAD_ZOOM,
  TAINAN_CENTER,
} from "@/lib/constants";
import { upsertIntelligenceLayers } from "@/lib/map-layers";
import { applyDarkDrivingTheme } from "@/lib/map-style";
import type {
  AccidentReport,
  CameraMode,
  CctvCamera,
  DisasterAlert,
  TrafficSegment,
  VehiclePose,
} from "@/types/domain";

type DrivingMapProps = {
  vehicle: VehiclePose;
  cameraMode: CameraMode;
  followVehicle: boolean;
  selectedCctvId: string | null;
  cameras: CctvCamera[];
  traffic: TrafficSegment[];
  disasters: DisasterAlert[];
  accidents: AccidentReport[];
  route: [number, number][];
  onCctvSelect: (camera: CctvCamera) => void;
  onUserPan: () => void;
};

function drivingPadding(height: number, mode: CameraMode) {
  if (mode !== "3d") {
    return { top: 80, bottom: 180, left: 16, right: 16 };
  }
  return {
    top: Math.round(height * DRIVING_PADDING_RATIO),
    bottom: 0,
    left: 16,
    right: 16,
  };
}

function cameraOptions(
  map: MapLibreMap,
  vehicle: VehiclePose,
  mode: CameraMode,
) {
  const height = map.getContainer().clientHeight;
  return {
    center: [vehicle.lng, vehicle.lat] as [number, number],
    bearing: mode === "3d" ? vehicle.heading : 0,
    pitch: mode === "3d" ? DRIVING_PITCH : 0,
    zoom: mode === "3d" ? DRIVING_ZOOM : OVERHEAD_ZOOM,
    padding: drivingPadding(height, mode),
  };
}

function markerEl(
  className: string,
  symbol: string,
  label: string,
): HTMLDivElement {
  const el = document.createElement("div");
  el.className = `intel-marker ${className}`;
  el.title = label;
  el.innerHTML = `<span>${symbol}</span>`;
  return el;
}

export function DrivingMap({
  vehicle,
  cameraMode,
  followVehicle,
  selectedCctvId,
  cameras,
  traffic,
  disasters,
  accidents,
  route,
  onCctvSelect,
  onUserPan,
}: DrivingMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const vehicleMarkerRef = useRef<Marker | null>(null);
  const intelMarkersRef = useRef<Marker[]>([]);
  const onCctvSelectRef = useRef(onCctvSelect);
  const onUserPanRef = useRef(onUserPan);
  const modeRef = useRef(cameraMode);
  const vehicleRef = useRef(vehicle);
  const routeRef = useRef(route);
  const trafficRef = useRef(traffic);
  const readyRef = useRef(false);

  useEffect(() => {
    onCctvSelectRef.current = onCctvSelect;
    onUserPanRef.current = onUserPan;
    modeRef.current = cameraMode;
    vehicleRef.current = vehicle;
    routeRef.current = route;
    trafficRef.current = traffic;
  }, [onCctvSelect, onUserPan, cameraMode, vehicle, route, traffic]);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = new MapLibreMap({
      container: containerRef.current,
      style: OPENFREEMAP_DARK_STYLE,
      center: [TAINAN_CENTER.lng, TAINAN_CENTER.lat],
      zoom: DRIVING_ZOOM,
      pitch: DRIVING_PITCH,
      bearing: vehicle.heading,
      maxPitch: 80,
      attributionControl: { compact: true },
      fadeDuration: 0,
    });

    mapRef.current = map;

    const vehicleEl = createVehicleMarkerElement();
    vehicleMarkerRef.current = new Marker({
      element: vehicleEl,
      anchor: "center",
      pitchAlignment: "viewport",
      rotationAlignment: "viewport",
    })
      .setLngLat([vehicle.lng, vehicle.lat])
      .addTo(map);

    const onLoad = () => {
      applyDarkDrivingTheme(map);
      upsertIntelligenceLayers(map, routeRef.current, trafficRef.current);
      readyRef.current = true;
      map.jumpTo(cameraOptions(map, vehicleRef.current, modeRef.current));
    };

    map.on("load", onLoad);
    map.on("dragstart", () => onUserPanRef.current());
    map.on("rotatestart", (event) => {
      if (event.originalEvent) onUserPanRef.current();
    });

    return () => {
      readyRef.current = false;
      vehicleMarkerRef.current?.remove();
      vehicleMarkerRef.current = null;
      for (const marker of intelMarkersRef.current) marker.remove();
      intelMarkersRef.current = [];
      map.remove();
      mapRef.current = null;
    };
    // Mount once; subsequent updates go through dedicated effects.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !readyRef.current) return;
    upsertIntelligenceLayers(map, route, traffic);
  }, [route, traffic]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    for (const marker of intelMarkersRef.current) marker.remove();
    intelMarkersRef.current = [];

    for (const camera of cameras) {
      const el = markerEl(
        `intel-marker--cctv${selectedCctvId === camera.id ? " is-selected" : ""}`,
        "◎",
        camera.name,
      );
      el.addEventListener("click", (event) => {
        event.stopPropagation();
        onCctvSelectRef.current(camera);
      });
      intelMarkersRef.current.push(
        new Marker({ element: el, anchor: "bottom" })
          .setLngLat([camera.location.lng, camera.location.lat])
          .addTo(map),
      );
    }

    for (const accident of accidents) {
      const el = markerEl("intel-marker--accident", "!", accident.title);
      intelMarkersRef.current.push(
        new Marker({ element: el, anchor: "bottom" })
          .setLngLat([accident.location.lng, accident.location.lat])
          .addTo(map),
      );
    }

    for (const disaster of disasters) {
      const el = markerEl("intel-marker--disaster", "▲", disaster.title);
      intelMarkersRef.current.push(
        new Marker({ element: el, anchor: "bottom" })
          .setLngLat([disaster.location.lng, disaster.location.lat])
          .addTo(map),
      );
    }
  }, [cameras, accidents, disasters, selectedCctvId]);

  useEffect(() => {
    const marker = vehicleMarkerRef.current;
    const map = mapRef.current;
    if (!marker || !map) return;

    marker.setLngLat([vehicle.lng, vehicle.lat]);
    marker.setRotation(cameraMode === "3d" ? 0 : vehicle.heading);

    if (!followVehicle || !readyRef.current) return;

    const duration = vehicle.source === "gps" ? 450 : 700;
    map.easeTo({
      ...cameraOptions(map, vehicle, cameraMode),
      duration,
      essential: true,
    });
  }, [vehicle, cameraMode, followVehicle]);

  return <div ref={containerRef} className="absolute inset-0 h-full w-full" />;
}
