"use client";

import { useEffect, useRef } from "react";
import { LngLatBounds, Map as MapLibreMap, Marker } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import {
  createVehicleMarkerElement,
  setVehicleMarkerNavigating,
} from "@/components/map/vehicle-marker";
import {
  DRIVING_PADDING_RATIO,
  DRIVING_PITCH,
  DRIVING_ZOOM,
  DRIVING_ZOOM_MOBILE,
  INTERSECTION_PITCH,
  INTERSECTION_ZOOM,
  INTERSECTION_ZOOM_MOBILE,
  NAVIGATION_PITCH,
  OPENFREEMAP_DARK_STYLE,
  OVERHEAD_ZOOM,
  OVERVIEW_PITCH,
  TAINAN_CENTER,
} from "@/lib/constants";
import { bindCctvLayerClicks, upsertCctvLayer } from "@/lib/cctv-layer";
import { bindDisasterLayerClicks, upsertDisasterLayer } from "@/lib/disaster-layer";
import { upsertGuidanceArrows } from "@/lib/guidance-arrows";
import { upsertIntelligenceLayers } from "@/lib/map-layers";
import { configureMapLibreWorker } from "@/lib/maplibre-worker";
import { applyDarkDrivingTheme } from "@/lib/map-style";
import { damp, distanceKm, lerp, lerpAngle } from "@/lib/geo";
import { upsertSpeedEnforcementLayer } from "@/lib/speed-enforcement-layer";
import type {
  AccidentReport,
  CameraMode,
  CctvCamera,
  DisasterAlert,
  MapViewport,
  RouteDestination,
  SpeedEnforcementPoint,
  TrafficSegment,
  VehiclePose,
} from "@/types/domain";

type DrivingMapProps = {
  vehicle: VehiclePose;
  cameraMode: CameraMode;
  followVehicle: boolean;
  navigating: boolean;
  selectedCctvId: string | null;
  selectedDisasterId: string | null;
  cameras: CctvCamera[];
  speedEnforcement: SpeedEnforcementPoint[];
  traffic: TrafficSegment[];
  disasters: DisasterAlert[];
  accidents: AccidentReport[];
  route: [number, number][];
  routeMeters: number;
  distanceToNextMeters: number;
  approachingIntersection: boolean;
  destination: RouteDestination | null;
  fitRouteKey: number;
  onCctvSelect: (cameraId: string) => void;
  onDisasterSelect: (alertId: string) => void;
  onUserPan: () => void;
  onViewportChange: (viewport: MapViewport) => void;
};

function isCompactViewport(width: number) {
  return width < 640;
}

function drivingPadding(height: number, width: number, mode: CameraMode) {
  const compact = isCompactViewport(width);
  const bottomPad = compact ? 96 : 118;
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
  navigating = false,
  approaching = false,
) {
  const height = map.getContainer().clientHeight;
  const width = map.getContainer().clientWidth;
  const compact = isCompactViewport(width);
  const navZoom = approaching
    ? compact
      ? INTERSECTION_ZOOM_MOBILE
      : INTERSECTION_ZOOM
    : compact
      ? DRIVING_ZOOM_MOBILE
      : DRIVING_ZOOM;
  return {
    center: [vehicle.lng, vehicle.lat] as [number, number],
    bearing: mode === "3d" ? vehicle.heading : 0,
    pitch:
      mode === "3d"
        ? approaching
          ? INTERSECTION_PITCH
          : navigating
            ? NAVIGATION_PITCH
            : DRIVING_PITCH
        : 0,
    zoom: mode === "3d" ? navZoom : OVERHEAD_ZOOM,
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

function createDestinationBeacon(label: string): HTMLDivElement {
  const el = document.createElement("div");
  el.className = "destination-beacon";
  el.title = label;
  el.innerHTML =
    '<span class="destination-beacon__ring"></span>' +
    '<span class="destination-beacon__ring destination-beacon__ring--delay"></span>' +
    '<span class="destination-beacon__dot"></span>';
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
  navigating,
  selectedCctvId,
  selectedDisasterId,
  cameras,
  speedEnforcement,
  traffic,
  disasters,
  accidents,
  route,
  routeMeters,
  distanceToNextMeters,
  approachingIntersection,
  destination,
  fitRouteKey,
  onCctvSelect,
  onDisasterSelect,
  onUserPan,
  onViewportChange,
}: DrivingMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const vehicleMarkerRef = useRef<Marker | null>(null);
  const intelMarkersRef = useRef<Marker[]>([]);
  const destMarkerRef = useRef<Marker | null>(null);
  const onCctvSelectRef = useRef(onCctvSelect);
  const onDisasterSelectRef = useRef(onDisasterSelect);
  const onUserPanRef = useRef(onUserPan);
  const onViewportChangeRef = useRef(onViewportChange);
  const modeRef = useRef(cameraMode);
  const vehicleRef = useRef(vehicle);
  const routeRef = useRef(route);
  const trafficRef = useRef(traffic);
  const camerasRef = useRef(cameras);
  const speedEnforcementRef = useRef(speedEnforcement);
  const selectedRef = useRef(selectedCctvId);
  const disastersRef = useRef(disasters);
  const selectedDisasterRef = useRef(selectedDisasterId);
  const followVehicleRef = useRef(followVehicle);
  const navigatingRef = useRef(navigating);
  const approachingRef = useRef(approachingIntersection);
  const routeMetersRef = useRef(routeMeters);
  const distanceToNextRef = useRef(distanceToNextMeters);
  const pinchingRef = useRef(false);
  const userZoomRef = useRef<number | null>(null);
  const arrowPhaseRef = useRef(0);
  const lastArrowUpdateRef = useRef(0);
  const readyRef = useRef(false);
  const lastFrameRef = useRef(0);
  const lastViewportEmitRef = useRef(0);
  const lastEmittedZoomRef = useRef(0);
  const rafRef = useRef(0);

  useEffect(() => {
    onCctvSelectRef.current = onCctvSelect;
    onDisasterSelectRef.current = onDisasterSelect;
    onUserPanRef.current = onUserPan;
    onViewportChangeRef.current = onViewportChange;
    modeRef.current = cameraMode;
    vehicleRef.current = vehicle;
    routeRef.current = route;
    trafficRef.current = traffic;
    camerasRef.current = cameras;
    speedEnforcementRef.current = speedEnforcement;
    selectedRef.current = selectedCctvId;
    disastersRef.current = disasters;
    selectedDisasterRef.current = selectedDisasterId;
    navigatingRef.current = navigating;
    approachingRef.current = approachingIntersection;
    routeMetersRef.current = routeMeters;
    distanceToNextRef.current = distanceToNextMeters;
  }, [
    onCctvSelect,
    onDisasterSelect,
    onUserPan,
    onViewportChange,
    cameraMode,
    vehicle,
    route,
    traffic,
    cameras,
    speedEnforcement,
    selectedCctvId,
    selectedDisasterId,
    disasters,
    navigating,
    approachingIntersection,
    routeMeters,
    distanceToNextMeters,
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
      dragPan: true,
      scrollZoom: true,
      touchZoomRotate: true,
      doubleClickZoom: true,
      cooperativeGestures: false,
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

    const emitViewport = (force = false) => {
      if (!readyRef.current) return;
      const now = performance.now();
      const currentZoom = map.getZoom();
      const zoomJump = Math.abs(currentZoom - lastEmittedZoomRef.current);
      if (
        !force &&
        followVehicleRef.current &&
        zoomJump < 0.18 &&
        now - lastViewportEmitRef.current < 450
      ) {
        return;
      }
      lastViewportEmitRef.current = now;
      lastEmittedZoomRef.current = currentZoom;
      onViewportChangeRef.current(readViewport(map));
    };

    const tick = (now: number) => {
      const mapNow = mapRef.current;
      const marker = vehicleMarkerRef.current;
      if (!mapNow || !marker || !readyRef.current) {
        rafRef.current = requestAnimationFrame(tick);
        return;
      }

      const last = lastFrameRef.current || now;
      const dt = Math.min(0.05, (now - last) / 1000);
      lastFrameRef.current = now;

      const target = vehicleRef.current;
      const here = marker.getLngLat();
      const jumpKm = distanceKm(
        { lng: here.lng, lat: here.lat },
        { lng: target.lng, lat: target.lat },
      );
      const tau = jumpKm > 0.35 ? 0.14 : 0.26;
      const t = damp(dt, tau);

      const nextLng = lerp(here.lng, target.lng, t);
      const nextLat = lerp(here.lat, target.lat, t);
      marker.setLngLat([nextLng, nextLat]);

      const headingUp = modeRef.current === "3d";
      setVehicleMarkerNavigating(marker.getElement(), navigatingRef.current);
      marker.setRotation(headingUp ? 0 : target.heading);

      if (navigatingRef.current) {
        arrowPhaseRef.current = (arrowPhaseRef.current + dt * 0.55) % 1;
        if (now - lastArrowUpdateRef.current > 70) {
          lastArrowUpdateRef.current = now;
          try {
            upsertGuidanceArrows(
              mapNow,
              routeRef.current,
              routeMetersRef.current,
              distanceToNextRef.current,
              true,
              arrowPhaseRef.current,
            );
          } catch {
            /* style may still be swapping */
          }
        }
      }

      if (followVehicleRef.current) {
        const wanted = cameraOptions(
          mapNow,
          target,
          modeRef.current,
          navigatingRef.current,
          approachingRef.current,
        );
        const center = mapNow.getCenter();
        const zoomTarget = pinchingRef.current
          ? mapNow.getZoom()
          : (userZoomRef.current ?? wanted.zoom);
        mapNow.jumpTo({
          center: [
            lerp(center.lng, wanted.center[0], t),
            lerp(center.lat, wanted.center[1], t),
          ],
          bearing: lerpAngle(mapNow.getBearing(), wanted.bearing, t),
          pitch: lerp(mapNow.getPitch(), wanted.pitch, t),
          zoom: lerp(mapNow.getZoom(), zoomTarget, pinchingRef.current ? 0 : t),
          padding: wanted.padding,
        });
        emitViewport();
      }

      rafRef.current = requestAnimationFrame(tick);
    };

    const onLoad = () => {
      applyDarkDrivingTheme(map);
      upsertIntelligenceLayers(map, routeRef.current, trafficRef.current);
      upsertSpeedEnforcementLayer(map, speedEnforcementRef.current);
      try {
        upsertCctvLayer(map, camerasRef.current, selectedRef.current);
        bindCctvLayerClicks(map, (id) => onCctvSelectRef.current(id));
        upsertDisasterLayer(map, disastersRef.current, selectedDisasterRef.current);
        bindDisasterLayerClicks(map, (id) => onDisasterSelectRef.current(id));
      } catch (error) {
        console.error("CCTV layer skipped", error);
      }
      readyRef.current = true;
      map.jumpTo(
        cameraOptions(
          map,
          vehicleRef.current,
          modeRef.current,
          navigatingRef.current,
          approachingRef.current,
        ),
      );
      emitViewport(true);
      lastFrameRef.current = performance.now();
      rafRef.current = requestAnimationFrame(tick);
    };

    map.on("load", onLoad);
    map.on("error", (event) => {
      console.error("MapLibre error", event.error);
    });
    const onResize = () => {
      if (!readyRef.current) return;
      map.resize();
      emitViewport(true);
    };
    window.addEventListener("resize", onResize);
    const canvas = map.getCanvas();
    const detachFollow = () => {
      followVehicleRef.current = false;
      onUserPanRef.current();
    };
    const rememberZoom = () => {
      userZoomRef.current = map.getZoom();
    };
    const onTouchStart = (event: TouchEvent) => {
      if (event.touches.length >= 2) {
        pinchingRef.current = true;
        return;
      }
      detachFollow();
    };
    const onTouchEnd = () => {
      if (pinchingRef.current) rememberZoom();
      pinchingRef.current = false;
    };
    const onPointerDown = (event: PointerEvent) => {
      if (event.pointerType === "touch") return;
      if (event.button !== 0) return;
      detachFollow();
    };
    canvas.addEventListener("touchstart", onTouchStart, { passive: true });
    canvas.addEventListener("touchend", onTouchEnd, { passive: true });
    canvas.addEventListener("touchcancel", onTouchEnd, { passive: true });
    canvas.addEventListener("pointerdown", onPointerDown);
    map.on("zoomstart", (event) => {
      if (event.originalEvent) pinchingRef.current = true;
    });
    map.on("wheel", () => {
      pinchingRef.current = true;
      window.setTimeout(() => {
        rememberZoom();
        pinchingRef.current = false;
      }, 180);
    });
    map.on("dragstart", (event) => {
      if (pinchingRef.current) return;
      if (event.originalEvent instanceof TouchEvent && event.originalEvent.touches.length >= 2) {
        pinchingRef.current = true;
        return;
      }
      detachFollow();
    });
    map.on("rotatestart", (event) => {
      if (event.originalEvent && !pinchingRef.current) detachFollow();
    });
    map.on("zoomend", () => {
      if (pinchingRef.current) rememberZoom();
    });
    map.on("zoom", () => {
      emitViewport();
    });
    map.on("moveend", () => {
      emitViewport(true);
    });
    map.on("zoomend", () => {
      emitViewport(true);
    });

    return () => {
      window.removeEventListener("resize", onResize);
      canvas.removeEventListener("touchstart", onTouchStart);
      canvas.removeEventListener("touchend", onTouchEnd);
      canvas.removeEventListener("touchcancel", onTouchEnd);
      canvas.removeEventListener("pointerdown", onPointerDown);
      cancelAnimationFrame(rafRef.current);
      readyRef.current = false;
      vehicleMarkerRef.current?.remove();
      vehicleMarkerRef.current = null;
      destMarkerRef.current?.remove();
      destMarkerRef.current = null;
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
    if (!navigating) {
      upsertGuidanceArrows(map, route, 0, 0, false, 0);
    }
  }, [navigating, route, traffic]);

  useEffect(() => {
    followVehicleRef.current = followVehicle;
    if (followVehicle) userZoomRef.current = null;
  }, [followVehicle]);

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
    if (!map || !readyRef.current) return;
    upsertDisasterLayer(map, disasters, selectedDisasterId);
  }, [disasters, selectedDisasterId]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !readyRef.current) return;
    upsertSpeedEnforcementLayer(map, speedEnforcement);
  }, [speedEnforcement]);

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

  }, [accidents]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    destMarkerRef.current?.remove();
    destMarkerRef.current = null;
    if (!destination) return;
    destMarkerRef.current = new Marker({
      element: createDestinationBeacon(destination.label),
      anchor: "center",
    })
      .setLngLat([destination.location.lng, destination.location.lat])
      .addTo(map);
  }, [destination]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !readyRef.current || !fitRouteKey || route.length < 2) return;
    const bounds = route.reduce(
      (box, coord) => box.extend(coord),
      new LngLatBounds(route[0], route[0]),
    );
    const compact = isCompactViewport(map.getContainer().clientWidth);
    map.fitBounds(bounds, {
      padding: {
        top: compact ? 120 : 110,
        bottom: compact ? 140 : 130,
        left: 36,
        right: compact ? 72 : 48,
      },
      duration: 900,
      pitch: OVERVIEW_PITCH,
      bearing: 0,
      maxZoom: 16.2,
      essential: true,
    });
  }, [cameraMode, fitRouteKey, route]);

  return <div ref={containerRef} className="absolute inset-0 h-full w-full touch-none" />;
}
