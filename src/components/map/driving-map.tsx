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
  OVERHEAD_ZOOM,
  OVERVIEW_PITCH,
  TAINAN_CENTER,
} from "@/lib/constants";
import { junctionZoomProgress } from "@/lib/upcoming-route";
import { bindCctvLayerClicks, upsertCctvLayer } from "@/lib/cctv-layer";
import {
  bindConstructionLayerClicks,
  upsertConstructionLayer,
} from "@/lib/construction-layer";
import { bindParkingLayerClicks, upsertParkingLayer } from "@/lib/parking-layer";
import { bindAccidentLayerClicks, upsertAccidentLayer } from "@/lib/event-layer";
import { bindDisasterLayerClicks, upsertDisasterLayer } from "@/lib/disaster-layer";
import { upsertGuidanceArrows } from "@/lib/guidance-arrows";
import { upsertIntelligenceLayers } from "@/lib/map-layers";
import { configureMapLibreWorker } from "@/lib/maplibre-worker";
import { applyResolvedTheme, basemapStyle } from "@/lib/map-basemap";
import { resolveMapBasemap } from "@/lib/map-display-mode";
import { damp, lerp, lerpAngle } from "@/lib/geo";
import { createRouteProgressModel } from "@/lib/route-progress";
import {
  createVehicleDisplayState,
  stepVehicleDisplay,
  type VehicleDisplayState,
} from "@/lib/vehicle-display";
import { upsertSpeedEnforcementLayer } from "@/lib/speed-enforcement-layer";
import type {
  AccidentReport,
  CameraMode,
  CctvCamera,
  ConstructionEvent,
  DisasterAlert,
  FollowOrientation,
  LayerKindVisibility,
  LngLat,
  MapDisplayMode,
  MapFocusTarget,
  MapViewport,
  DisplayPose,
  ParkingLot,
  RouteDestination,
  SpeedEnforcementPoint,
  TrafficSegment,
  VehiclePose,
} from "@/types/domain";

const DEFAULT_LAYER_VISIBILITY: LayerKindVisibility = {
  congestion: true,
  cctv: true,
  construction: true,
  accident: true,
  disaster: true,
};

type DrivingMapProps = {
  vehicle: VehiclePose;
  displayVehicle?: DisplayPose | null;
  cameraMode: CameraMode;
  followOrientation?: FollowOrientation;
  followVehicle: boolean;
  mapDisplayMode?: MapDisplayMode;
  styleRevision?: number;
  pickMode?: boolean;
  navigating: boolean;
  selectedCctvId: string | null;
  selectedDisasterId: string | null;
  selectedAccidentId?: string | null;
  selectedConstructionId?: string | null;
  cameras: CctvCamera[];
  speedEnforcement: SpeedEnforcementPoint[];
  traffic: TrafficSegment[];
  disasters: DisasterAlert[];
  accidents: AccidentReport[];
  constructions?: ConstructionEvent[];
  parkingLots?: ParkingLot[];
  selectedParkingId?: string | null;
  parkingVisible?: boolean;
  layerVisibility?: LayerKindVisibility;
  focusTarget?: MapFocusTarget | null;
  route: [number, number][];
  routeMeters: number;
  distanceToNextMeters: number;
  approachingIntersection: boolean;
  junctionCue?: LngLat | null;
  destination: RouteDestination | null;
  overlayPadding?: {
    top: number;
    left: number;
    right: number;
    bottom: number;
  } | null;
  fitRouteKey: number;
  onCctvSelect: (cameraId: string) => void;
  onDisasterSelect: (alertId: string) => void;
  onAccidentSelect?: (accidentId: string) => void;
  onConstructionSelect?: (constructionId: string) => void;
  onParkingSelect?: (parkingId: string) => void;
  onUserPan: () => void;
  onViewportChange: (viewport: MapViewport) => void;
  onLongPress?: (location: { lng: number; lat: number }) => void;
  onPickLocation?: (location: { lng: number; lat: number }) => void;
  onStyleFallback?: (message: string) => void;
};

function isCompactViewport(width: number) {
  return width < 640;
}

function drivingPadding(
  height: number,
  width: number,
  mode: CameraMode,
  navigating = false,
  overlay?: DrivingMapProps["overlayPadding"],
) {
  const compact = isCompactViewport(width);
  const bottomPad = compact ? 96 : 118;
  const rightPad = compact ? 58 : 20;
  const base =
    mode !== "3d"
      ? {
          top: compact ? 108 : 96,
          bottom: bottomPad,
          left: 12,
          right: rightPad,
        }
      : {
          top: Math.max(
            Math.round((height - bottomPad) * DRIVING_PADDING_RATIO),
            compact ? 96 : 80,
          ),
          bottom: bottomPad,
          left: 12,
          right: rightPad,
        };
  if (!navigating || !overlay) return base;
  return {
    top: Math.max(base.top, overlay.top),
    bottom: Math.max(base.bottom, overlay.bottom),
    left: Math.max(base.left, overlay.left),
    right: Math.max(base.right, overlay.right),
  };
}

function cameraOptions(
  map: MapLibreMap,
  vehicle: VehiclePose,
  mode: CameraMode,
  navigating = false,
  approaching = false,
  overlay?: DrivingMapProps["overlayPadding"],
  distanceToNext = Number.POSITIVE_INFINITY,
  junctionCue: LngLat | null = null,
  followOrientation: FollowOrientation = "heading-up",
) {
  const height = map.getContainer().clientHeight;
  const width = map.getContainer().clientWidth;
  const compact = isCompactViewport(width);
  const blend = approaching ? junctionZoomProgress(distanceToNext) : 0;
  const cruiseZoom = compact ? DRIVING_ZOOM_MOBILE : DRIVING_ZOOM;
  const focusZoom = compact ? INTERSECTION_ZOOM_MOBILE : INTERSECTION_ZOOM;
  const navZoom = lerp(cruiseZoom, focusZoom, blend);
  const cruisePitch = navigating ? NAVIGATION_PITCH : DRIVING_PITCH;
  const towardCue = approaching && junctionCue ? blend * 0.36 : 0;
  return {
    center: [
      lerp(vehicle.lng, junctionCue?.lng ?? vehicle.lng, towardCue),
      lerp(vehicle.lat, junctionCue?.lat ?? vehicle.lat, towardCue),
    ] as [number, number],
    bearing: followOrientation === "heading-up" ? vehicle.heading : 0,
    pitch: mode === "3d" ? lerp(cruisePitch, INTERSECTION_PITCH, blend) : 0,
    zoom: mode === "3d" ? navZoom : OVERHEAD_ZOOM,
    padding: drivingPadding(height, width, mode, navigating, overlay),
  };
}

function createDestinationPin(label: string): HTMLDivElement {
  const el = document.createElement("div");
  el.className = "destination-pin";
  el.title = label;
  el.innerHTML = `
    <span class="destination-beacon" aria-hidden="true">
      <span class="destination-beacon__ring"></span>
      <span class="destination-beacon__ring"></span>
      <span class="destination-beacon__ring"></span>
      <span class="destination-beacon__dot"></span>
    </span>
    <span class="destination-pin__glow"></span>
    <svg class="destination-pin__mark" viewBox="0 0 48 58" width="30" height="36" aria-hidden="true">
      <defs>
        <linearGradient id="pin-left" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0%" stop-color="#ffe56a"/>
          <stop offset="42%" stop-color="#ffb027"/>
          <stop offset="100%" stop-color="#e67a10"/>
        </linearGradient>
        <linearGradient id="pin-right" x1="1" x2="0" y1="0" y2="1">
          <stop offset="0%" stop-color="#ffcf4a"/>
          <stop offset="55%" stop-color="#f08812"/>
          <stop offset="100%" stop-color="#b45309"/>
        </linearGradient>
        <linearGradient id="pin-ridge" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stop-color="#fff4b8"/>
          <stop offset="100%" stop-color="#ffd36a"/>
        </linearGradient>
      </defs>
      <ellipse cx="24" cy="52" rx="9" ry="3.2" fill="#ff9a1a" opacity="0.38"/>
      <path d="M24 3 L42 36 L24 50 Z" fill="url(#pin-right)"/>
      <path d="M24 3 L6 36 L24 50 Z" fill="url(#pin-left)"/>
      <path d="M24 3 L27.2 49 L20.8 49 Z" fill="url(#pin-ridge)" opacity="0.72"/>
      <path d="M24 3 L42 36 L24 50 L6 36 Z" fill="none" stroke="#fff6d2" stroke-width="1.15" stroke-linejoin="round"/>
    </svg>
  `;
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
  displayVehicle = null,
  cameraMode,
  followOrientation = "heading-up",
  followVehicle,
  mapDisplayMode = "dark",
  styleRevision = 0,
  pickMode = false,
  navigating,
  selectedCctvId,
  selectedDisasterId,
  selectedAccidentId = null,
  selectedConstructionId = null,
  cameras,
  speedEnforcement,
  traffic,
  disasters,
  accidents,
  constructions = [],
  parkingLots = [],
  selectedParkingId = null,
  parkingVisible = false,
  layerVisibility = DEFAULT_LAYER_VISIBILITY,
  focusTarget = null,
  route,
  routeMeters,
  distanceToNextMeters,
  approachingIntersection,
  junctionCue = null,
  destination,
  overlayPadding = null,
  fitRouteKey,
  onCctvSelect,
  onDisasterSelect,
  onAccidentSelect,
  onConstructionSelect,
  onParkingSelect,
  onUserPan,
  onViewportChange,
  onLongPress,
  onPickLocation,
  onStyleFallback,
}: DrivingMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const vehicleMarkerRef = useRef<Marker | null>(null);
  const intelMarkersRef = useRef<Marker[]>([]);
  const destMarkerRef = useRef<Marker | null>(null);
  const onCctvSelectRef = useRef(onCctvSelect);
  const onDisasterSelectRef = useRef(onDisasterSelect);
  const onAccidentSelectRef = useRef(onAccidentSelect);
  const onConstructionSelectRef = useRef(onConstructionSelect);
  const onParkingSelectRef = useRef(onParkingSelect);
  const onUserPanRef = useRef(onUserPan);
  const onViewportChangeRef = useRef(onViewportChange);
  const onLongPressRef = useRef(onLongPress);
  const onPickLocationRef = useRef(onPickLocation);
  const onStyleFallbackRef = useRef(onStyleFallback);
  const modeRef = useRef(cameraMode);
  const followOrientationRef = useRef(followOrientation);
  const pickModeRef = useRef(pickMode);
  const mapDisplayModeRef = useRef(mapDisplayMode);
  const pickMarkerRef = useRef<Marker | null>(null);
  const styleKeyRef = useRef(resolveMapBasemap(mapDisplayMode));
  const vehicleRef = useRef(vehicle);
  const displayVehicleRef = useRef(displayVehicle);
  const displayStateRef = useRef<VehicleDisplayState>(
    createVehicleDisplayState(displayVehicle ?? vehicle),
  );
  const lastFixKeyRef = useRef(`${vehicle.lng},${vehicle.lat}`);
  const lastFixAtRef = useRef(0);
  const routeModelRef = useRef(createRouteProgressModel(route, []));
  const routeRef = useRef(route);
  const trafficRef = useRef(traffic);
  const camerasRef = useRef(cameras);
  const speedEnforcementRef = useRef(speedEnforcement);
  const selectedRef = useRef(selectedCctvId);
  const disastersRef = useRef(disasters);
  const accidentsRef = useRef(accidents);
  const constructionsRef = useRef(constructions);
  const parkingLotsRef = useRef(parkingLots);
  const selectedParkingRef = useRef(selectedParkingId);
  const parkingVisibleRef = useRef(parkingVisible);
  const selectedDisasterRef = useRef(selectedDisasterId);
  const selectedAccidentRef = useRef(selectedAccidentId);
  const selectedConstructionRef = useRef(selectedConstructionId);
  const layerVisibilityRef = useRef(layerVisibility);
  const followVehicleRef = useRef(followVehicle);
  const navigatingRef = useRef(navigating);
  const approachingRef = useRef(approachingIntersection);
  const junctionCueRef = useRef(junctionCue);
  const routeMetersRef = useRef(routeMeters);
  const distanceToNextRef = useRef(distanceToNextMeters);
  const pinchingRef = useRef(false);
  const userZoomRef = useRef<number | null>(null);
  const overlayPaddingRef = useRef(overlayPadding);
  const lastArrowUpdateRef = useRef(0);
  const readyRef = useRef(false);
  const lastFrameRef = useRef(0);
  const lastViewportEmitRef = useRef(0);
  const lastEmittedZoomRef = useRef(0);
  const rafRef = useRef(0);

  useEffect(() => {
    onCctvSelectRef.current = onCctvSelect;
    onDisasterSelectRef.current = onDisasterSelect;
    onAccidentSelectRef.current = onAccidentSelect;
    onConstructionSelectRef.current = onConstructionSelect;
    onParkingSelectRef.current = onParkingSelect;
    onUserPanRef.current = onUserPan;
    onViewportChangeRef.current = onViewportChange;
    onLongPressRef.current = onLongPress;
    onPickLocationRef.current = onPickLocation;
    onStyleFallbackRef.current = onStyleFallback;
    modeRef.current = cameraMode;
    followOrientationRef.current = followOrientation;
    pickModeRef.current = pickMode;
    mapDisplayModeRef.current = mapDisplayMode;
    vehicleRef.current = vehicle;
    displayVehicleRef.current = displayVehicle;
    routeModelRef.current = createRouteProgressModel(route, []);
    const fixKey = `${vehicle.lng.toFixed(6)},${vehicle.lat.toFixed(6)}`;
    if (fixKey !== lastFixKeyRef.current) {
      lastFixKeyRef.current = fixKey;
      lastFixAtRef.current = performance.now();
      displayStateRef.current.predictedMeters = 0;
    }
    routeRef.current = route;
    trafficRef.current = traffic;
    camerasRef.current = cameras;
    speedEnforcementRef.current = speedEnforcement;
    selectedRef.current = selectedCctvId;
    disastersRef.current = disasters;
    accidentsRef.current = accidents;
    constructionsRef.current = constructions;
    parkingLotsRef.current = parkingLots;
    selectedParkingRef.current = selectedParkingId;
    parkingVisibleRef.current = parkingVisible;
    selectedDisasterRef.current = selectedDisasterId;
    selectedAccidentRef.current = selectedAccidentId;
    selectedConstructionRef.current = selectedConstructionId;
    layerVisibilityRef.current = layerVisibility;
    navigatingRef.current = navigating;
    approachingRef.current = approachingIntersection;
    junctionCueRef.current = junctionCue;
    routeMetersRef.current = routeMeters;
    distanceToNextRef.current = distanceToNextMeters;
    overlayPaddingRef.current = overlayPadding;
  }, [
    onCctvSelect,
    onDisasterSelect,
    onAccidentSelect,
    onConstructionSelect,
    onParkingSelect,
    onUserPan,
    onViewportChange,
    onLongPress,
    onPickLocation,
    onStyleFallback,
    cameraMode,
    followOrientation,
    pickMode,
    mapDisplayMode,
    vehicle,
    displayVehicle,
    route,
    traffic,
    cameras,
    speedEnforcement,
    selectedCctvId,
    selectedDisasterId,
    selectedAccidentId,
    selectedConstructionId,
    disasters,
    accidents,
    constructions,
    parkingLots,
    selectedParkingId,
    parkingVisible,
    layerVisibility,
    navigating,
    approachingIntersection,
    junctionCue,
    routeMeters,
    distanceToNextMeters,
    overlayPadding,
  ]);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    configureMapLibreWorker();

    const map = new MapLibreMap({
      container: containerRef.current,
      style: basemapStyle(resolveMapBasemap(mapDisplayMode)),
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

      const raw = vehicleRef.current;
      const snapTarget = displayVehicleRef.current;
      const target = snapTarget ?? raw;
      displayStateRef.current = stepVehicleDisplay({
        current: displayStateRef.current,
        target,
        raw,
        model: routeModelRef.current,
        navigating: navigatingRef.current,
        dtSeconds: dt,
        elapsedSinceFixSeconds: Math.max(0, (now - lastFixAtRef.current) / 1000),
      });
      const display = displayStateRef.current;
      marker.setLngLat([display.lng, display.lat]);

      const headingUp = followOrientationRef.current === "heading-up";
      setVehicleMarkerNavigating(marker.getElement(), navigatingRef.current);
      marker.setRotation(headingUp ? 0 : display.heading);

      if (navigatingRef.current) {
        if (now - lastArrowUpdateRef.current > 180) {
          lastArrowUpdateRef.current = now;
          try {
            upsertGuidanceArrows(
              mapNow,
              routeRef.current,
              routeMetersRef.current,
              distanceToNextRef.current,
              true,
              0,
            );
          } catch {
            /* style may still be swapping */
          }
        }
      }

      if (followVehicleRef.current) {
        const displayPose = {
          ...raw,
          lng: display.lng,
          lat: display.lat,
          heading: display.heading,
        };
        const wanted = cameraOptions(
          mapNow,
          displayPose,
          modeRef.current,
          navigatingRef.current,
          approachingRef.current,
          overlayPaddingRef.current,
          distanceToNextRef.current,
          junctionCueRef.current,
          followOrientationRef.current,
        );
        const center = mapNow.getCenter();
        const zoomTarget = pinchingRef.current
          ? mapNow.getZoom()
          : (userZoomRef.current ?? wanted.zoom);
        const followT = damp(dt, 0.22);
        mapNow.jumpTo({
          center: [
            lerp(center.lng, wanted.center[0], followT),
            lerp(center.lat, wanted.center[1], followT),
          ],
          bearing: lerpAngle(mapNow.getBearing(), wanted.bearing, followT),
          pitch: lerp(mapNow.getPitch(), wanted.pitch, followT),
          zoom: lerp(mapNow.getZoom(), zoomTarget, pinchingRef.current ? 0 : followT),
          padding: wanted.padding,
        });
        emitViewport();
      }

      rafRef.current = requestAnimationFrame(tick);
    };

    const attachCustomLayers = () => {
      const visible = layerVisibilityRef.current;
      applyResolvedTheme(map, resolveMapBasemap(mapDisplayModeRef.current));
      upsertIntelligenceLayers(map, routeRef.current, trafficRef.current, visible.congestion);
      upsertSpeedEnforcementLayer(map, speedEnforcementRef.current);
      try {
        upsertCctvLayer(map, camerasRef.current, selectedRef.current, visible.cctv);
        bindCctvLayerClicks(map, (id) => onCctvSelectRef.current(id));
        upsertDisasterLayer(map, disastersRef.current, selectedDisasterRef.current, visible.disaster);
        bindDisasterLayerClicks(map, (id) => onDisasterSelectRef.current(id));
        upsertAccidentLayer(map, accidentsRef.current, selectedAccidentRef.current, visible.accident);
        bindAccidentLayerClicks(map, (id) => onAccidentSelectRef.current?.(id));
        upsertConstructionLayer(
          map,
          constructionsRef.current,
          selectedConstructionRef.current,
          visible.construction,
        );
        bindConstructionLayerClicks(map, (id) => onConstructionSelectRef.current?.(id));
        upsertParkingLayer(
          map,
          parkingLotsRef.current,
          selectedParkingRef.current,
          parkingVisibleRef.current,
        );
        bindParkingLayerClicks(map, (id) => onParkingSelectRef.current?.(id));
      } catch (error) {
        console.error("Event layer skipped", error);
      }
    };

    const onLoad = () => {
      attachCustomLayers();
      readyRef.current = true;
      map.jumpTo(
        cameraOptions(
          map,
          vehicleRef.current,
          modeRef.current,
          navigatingRef.current,
          approachingRef.current,
          overlayPaddingRef.current,
        ),
      );
      emitViewport(true);
      lastFrameRef.current = performance.now();
      rafRef.current = requestAnimationFrame(tick);
    };

    const onMapClick = (event: { lngLat: { lng: number; lat: number } }) => {
      if (!pickModeRef.current) return;
      const { lng, lat } = event.lngLat;
      pickMarkerRef.current?.remove();
      pickMarkerRef.current = new Marker({ color: "#22d3ee", anchor: "bottom" })
        .setLngLat([lng, lat])
        .addTo(map);
      onPickLocationRef.current?.({ lng, lat });
    };
    map.on("load", onLoad);
    map.on("click", onMapClick);
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
    let pressTimer = 0;
    let pressX = 0;
    let pressY = 0;
    const cancelPress = () => {
      if (pressTimer) window.clearTimeout(pressTimer);
      pressTimer = 0;
    };
    const fireLongPress = (lng: number, lat: number) => {
      if (navigatingRef.current) return;
      onLongPressRef.current?.({ lng, lat });
    };
    const schedulePress = (clientX: number, clientY: number) => {
      cancelPress();
      pressX = clientX;
      pressY = clientY;
      const rect = canvas.getBoundingClientRect();
      const point = map.unproject([clientX - rect.left, clientY - rect.top]);
      pressTimer = window.setTimeout(() => {
        pressTimer = 0;
        fireLongPress(point.lng, point.lat);
      }, 560);
    };
    const onTouchStart = (event: TouchEvent) => {
      if (event.touches.length >= 2) {
        pinchingRef.current = true;
        cancelPress();
        return;
      }
      const touch = event.touches[0];
      if (touch) schedulePress(touch.clientX, touch.clientY);
      detachFollow();
    };
    const onTouchMove = (event: TouchEvent) => {
      const touch = event.touches[0];
      if (!touch || !pressTimer) return;
      const dx = touch.clientX - pressX;
      const dy = touch.clientY - pressY;
      if (Math.hypot(dx, dy) > 14) cancelPress();
    };
    const onTouchEnd = () => {
      cancelPress();
      if (pinchingRef.current) rememberZoom();
      pinchingRef.current = false;
    };
    const onPointerDown = (event: PointerEvent) => {
      if (event.pointerType === "touch") return;
      if (event.button === 2) return;
      if (event.button !== 0) return;
      schedulePress(event.clientX, event.clientY);
      detachFollow();
    };
    const onPointerMove = (event: PointerEvent) => {
      if (event.pointerType === "touch" || !pressTimer) return;
      const dx = event.clientX - pressX;
      const dy = event.clientY - pressY;
      if (Math.hypot(dx, dy) > 14) cancelPress();
    };
    const onPointerUp = () => {
      if (pressTimer) cancelPress();
    };
    const onContextMenu = (event: MouseEvent) => {
      event.preventDefault();
      cancelPress();
      const rect = canvas.getBoundingClientRect();
      const point = map.unproject([
        event.clientX - rect.left,
        event.clientY - rect.top,
      ]);
      fireLongPress(point.lng, point.lat);
    };
    canvas.addEventListener("touchstart", onTouchStart, { passive: true });
    canvas.addEventListener("touchmove", onTouchMove, { passive: true });
    canvas.addEventListener("touchend", onTouchEnd, { passive: true });
    canvas.addEventListener("touchcancel", onTouchEnd, { passive: true });
    canvas.addEventListener("pointerdown", onPointerDown);
    canvas.addEventListener("pointermove", onPointerMove);
    canvas.addEventListener("pointerup", onPointerUp);
    canvas.addEventListener("contextmenu", onContextMenu);
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
      canvas.removeEventListener("touchmove", onTouchMove);
      canvas.removeEventListener("touchend", onTouchEnd);
      canvas.removeEventListener("touchcancel", onTouchEnd);
      canvas.removeEventListener("pointerdown", onPointerDown);
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerup", onPointerUp);
      canvas.removeEventListener("contextmenu", onContextMenu);
      cancelAnimationFrame(rafRef.current);
      readyRef.current = false;
      pickMarkerRef.current?.remove();
      pickMarkerRef.current = null;
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
    upsertIntelligenceLayers(map, route, traffic, layerVisibility.congestion);
    if (!navigating) {
      upsertGuidanceArrows(map, route, 0, 0, false, 0);
    }
  }, [layerVisibility.congestion, navigating, route, traffic]);

  useEffect(() => {
    followVehicleRef.current = followVehicle;
    if (followVehicle) userZoomRef.current = null;
  }, [followVehicle]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !readyRef.current) return;
    const resolved = resolveMapBasemap(mapDisplayMode);
    if (resolved === styleKeyRef.current) return;
    const camera = {
      center: map.getCenter(),
      zoom: map.getZoom(),
      pitch: map.getPitch(),
      bearing: map.getBearing(),
    };
    const onStyle = () => {
      styleKeyRef.current = resolved;
      applyResolvedTheme(map, resolved);
      try {
        const visible = layerVisibilityRef.current;
        upsertIntelligenceLayers(map, routeRef.current, trafficRef.current, visible.congestion);
        upsertSpeedEnforcementLayer(map, speedEnforcementRef.current);
        upsertCctvLayer(map, camerasRef.current, selectedRef.current, visible.cctv);
        bindCctvLayerClicks(map, (id) => onCctvSelectRef.current(id));
        upsertDisasterLayer(map, disastersRef.current, selectedDisasterRef.current, visible.disaster);
        bindDisasterLayerClicks(map, (id) => onDisasterSelectRef.current(id));
        upsertAccidentLayer(map, accidentsRef.current, selectedAccidentRef.current, visible.accident);
        bindAccidentLayerClicks(map, (id) => onAccidentSelectRef.current?.(id));
        upsertConstructionLayer(
          map,
          constructionsRef.current,
          selectedConstructionRef.current,
          visible.construction,
        );
        bindConstructionLayerClicks(map, (id) => onConstructionSelectRef.current?.(id));
        upsertParkingLayer(
          map,
          parkingLotsRef.current,
          selectedParkingRef.current,
          parkingVisibleRef.current,
        );
        bindParkingLayerClicks(map, (id) => onParkingSelectRef.current?.(id));
      } catch {
        onStyleFallbackRef.current?.("地圖圖層重新掛載失敗，已保留目前畫面。");
      }
      map.jumpTo(camera);
      if (vehicleMarkerRef.current) vehicleMarkerRef.current.addTo(map);
      if (destMarkerRef.current) destMarkerRef.current.addTo(map);
    };
    map.once("style.load", onStyle);
    try {
      map.setStyle(basemapStyle(resolved), { diff: false });
    } catch {
      styleKeyRef.current = "dark";
      onStyleFallbackRef.current?.("衛星或底圖載入失敗，已退回一般地圖。");
    }
  }, [mapDisplayMode, styleRevision]);

  useEffect(() => {
    if (pickMode) return;
    pickMarkerRef.current?.remove();
    pickMarkerRef.current = null;
  }, [pickMode]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !readyRef.current) return;
    try {
      upsertCctvLayer(map, cameras, selectedCctvId, layerVisibility.cctv);
    } catch (error) {
      console.error("CCTV layer update skipped", error);
    }
  }, [cameras, layerVisibility.cctv, selectedCctvId]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !readyRef.current) return;
    upsertDisasterLayer(map, disasters, selectedDisasterId, layerVisibility.disaster);
  }, [disasters, layerVisibility.disaster, selectedDisasterId]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !readyRef.current) return;
    upsertSpeedEnforcementLayer(map, speedEnforcement);
  }, [speedEnforcement]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    upsertAccidentLayer(map, accidents, selectedAccidentId, layerVisibility.accident);
  }, [accidents, layerVisibility.accident, selectedAccidentId]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !readyRef.current) return;
    upsertConstructionLayer(
      map,
      constructions,
      selectedConstructionId,
      layerVisibility.construction,
    );
  }, [constructions, layerVisibility.construction, selectedConstructionId]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !readyRef.current) return;
    upsertParkingLayer(map, parkingLots, selectedParkingId, parkingVisible);
  }, [parkingLots, parkingVisible, selectedParkingId]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !readyRef.current || !focusTarget) return;
    map.easeTo({
      center: [focusTarget.lng, focusTarget.lat],
      zoom: Math.max(map.getZoom(), 16.2),
      duration: 720,
      essential: true,
    });
  }, [focusTarget]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    destMarkerRef.current?.remove();
    destMarkerRef.current = null;
    if (!destination) return;
    destMarkerRef.current = new Marker({
      element: createDestinationPin(destination.label),
      anchor: "bottom",
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
