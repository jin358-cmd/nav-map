"use client";

import { useEffect, useRef } from "react";
import { Map as MapLibreMap, Marker } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { createVehicleMarkerElement } from "@/components/map/vehicle-marker";
import {
  DRIVING_PADDING_RATIO,
  DRIVING_PITCH,
  DRIVING_ZOOM,
  DRIVING_ZOOM_MOBILE,
  OPENFREEMAP_DARK_STYLE,
  OVERHEAD_ZOOM,
  TAINAN_CENTER,
} from "@/lib/constants";
import { bindCctvLayerClicks, upsertCctvLayer } from "@/lib/cctv-layer";
import { upsertIntelligenceLayers } from "@/lib/map-layers";
import { configureMapLibreWorker } from "@/lib/maplibre-worker";
import { applyDarkDrivingTheme } from "@/lib/map-style";
import type {
  AccidentReport,
  CameraMode,
  CctvCamera,
  DisasterAlert,
  MapViewport,
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
  onCctvSelect: (cameraId: string) => void;
  onUserPan: () => void;
  onViewportChange: (viewport: MapViewport) => void;
};

function isCompactViewport(width: number) {
  return width < 640;
}

function drivingPadding(height: number, width: number, mode: CameraMode) {
  const compact = isCompactViewport(width);
  const bottomPad = compact ? 158 : 196;
  const rightPad = compact ? 58 : 20;
  if (mode !== "3d") {
    return {
      top: compact ? 108 : 96,
      bottom: bottomPad,
      left: 12,
      right: rightPad,
    };
  }
  const topPad = Math.round((height - bottomPad) * DRIVING_PADDING_RATIO);
  return {
    top: Math.max(topPad, compact ? 96 : 80),
    bottom: bottomPad,
    left: 12,
    right: rightPad,
  };
}

function cameraOptions(
  map: MapLibreMap,
  vehicle: VehiclePose,
  mode: CameraMode,
) {
  const height = map.getContainer().clientHeight;
  const width = map.getContainer().clientWidth;
  const compact = isCompactViewport(width);
  return {
    center: [vehicle.lng, vehicle.lat] as [number, number],
    bearing: mode === "3d" ? vehicle.heading : 0,
    pitch: mode === "3d" ? DRIVING_PITCH : 0,
    zoom:
      mode === "3d"
        ? compact
          ? DRIVING_ZOOM_MOBILE
          : DRIVING_ZOOM
        : OVERHEAD_ZOOM,
    padding: drivingPadding(height, width, mode),
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

function readViewport(map: MapLibreMap): MapViewport {
  const center = map.getCenter();
  const bounds = map.getBounds();
  return {
    center: { lng: center.lng, lat: center.lat },
    zoom: map.getZoom(),
    bounds: {
      west: bounds.getWest(),
      south: bounds.getSouth(),
      east: bounds.getEast(),
      north: bounds.getNorth(),
    },
  };
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
  onViewportChange,
}: DrivingMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const vehicleMarkerRef = useRef<Marker | null>(null);
  const intelMarkersRef = useRef<Marker[]>([]);
  const onCctvSelectRef = useRef(onCctvSelect);
  const onUserPanRef = useRef(onUserPan);
  const onViewportChangeRef = useRef(onViewportChange);
  const modeRef = useRef(cameraMode);
  const vehicleRef = useRef(vehicle);
  const routeRef = useRef(route);
  const trafficRef = useRef(traffic);
  const camerasRef = useRef(cameras);
  const selectedRef = useRef(selectedCctvId);
  const followVehicleRef = useRef(followVehicle);
  const readyRef = useRef(false);

  useEffect(() => {
    onCctvSelectRef.current = onCctvSelect;
    onUserPanRef.current = onUserPan;
    onViewportChangeRef.current = onViewportChange;
    modeRef.current = cameraMode;
    vehicleRef.current = vehicle;
    routeRef.current = route;
    trafficRef.current = traffic;
    camerasRef.current = cameras;
    selectedRef.current = selectedCctvId;
    followVehicleRef.current = followVehicle;
  }, [
    onCctvSelect,
    onUserPan,
    onViewportChange,
    cameraMode,
    vehicle,
    route,
    traffic,
    cameras,
    selectedCctvId,
    followVehicle,
  ]);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    configureMapLibreWorker();

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
      try {
        upsertCctvLayer(map, camerasRef.current, selectedRef.current);
        bindCctvLayerClicks(map, (id) => onCctvSelectRef.current(id));
      } catch (error) {
        console.error("CCTV layer skipped", error);
      }
      readyRef.current = true;
      map.jumpTo(cameraOptions(map, vehicleRef.current, modeRef.current));
      onViewportChangeRef.current(readViewport(map));
    };

    map.on("load", onLoad);
    map.on("error", (event) => {
      console.error("MapLibre error", event.error);
    });
    const emitViewport = () => {
      if (!readyRef.current) return;
      onViewportChangeRef.current(readViewport(map));
    };
    const onResize = () => {
      if (!readyRef.current) return;
      map.resize();
      if (followVehicleRef.current) {
        map.jumpTo(cameraOptions(map, vehicleRef.current, modeRef.current));
      }
      emitViewport();
    };
    window.addEventListener("resize", onResize);
    map.on("dragstart", () => onUserPanRef.current());
    map.on("rotatestart", (event) => {
      if (event.originalEvent) onUserPanRef.current();
    });
    map.on("moveend", emitViewport);
    map.on("zoomend", emitViewport);

    return () => {
      window.removeEventListener("resize", onResize);
      readyRef.current = false;
      vehicleMarkerRef.current?.remove();
      vehicleMarkerRef.current = null;
      for (const marker of intelMarkersRef.current) marker.remove();
      intelMarkersRef.current = [];
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !readyRef.current) return;
    upsertIntelligenceLayers(map, route, traffic);
  }, [route, traffic]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !readyRef.current) return;
    try {
      upsertCctvLayer(map, cameras, selectedCctvId);
    } catch (error) {
      console.error("CCTV layer update skipped", error);
    }
  }, [cameras, selectedCctvId]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    for (const marker of intelMarkersRef.current) marker.remove();
    intelMarkersRef.current = [];

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
  }, [accidents, disasters]);

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
