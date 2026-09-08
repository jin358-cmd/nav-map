"use client";

import { useEffect, useRef, type MutableRefObject } from "react";
import { Map as MapLibreMap, Marker } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import {
  createVehicleMarkerElement,
  setVehicleMarkerHeading,
  setVehicleMarkerNavigating,
  setVehicleMarkerVisible,
} from "@/components/map/vehicle-marker";
import {
  BROWSE_VEHICLE_Y,
  CONSECUTIVE_TURN_METERS,
  DRIVING_PITCH,
  DRIVING_ZOOM,
  DRIVING_ZOOM_MOBILE,
  DRIVING_ZOOM_PORTRAIT,
  NAV_VEHICLE_Y,
  NAV_2D_PORTRAIT_VEHICLE_Y,
  NAV_LANDSCAPE_VEHICLE_X,
  NAV_LANDSCAPE_VEHICLE_Y,
  INTERSECTION_PITCH,
  INTERSECTION_PITCH_PORTRAIT,
  INTERSECTION_ZOOM,
  INTERSECTION_ZOOM_MOBILE,
  INTERSECTION_ZOOM_PORTRAIT,
  MANEUVER_RECOVER_MS,
  NAVIGATION_PITCH,
  NAVIGATION_PITCH_PORTRAIT,
  OVERHEAD_NAV_ZOOM,
  OVERHEAD_NAV_ZOOM_MOBILE,
  OVERHEAD_TURN_ZOOM,
  OVERHEAD_TURN_ZOOM_MOBILE,
  OVERHEAD_TURN_ZOOM_PORTRAIT,
  OVERHEAD_ZOOM,
  TAIWAN_OVERVIEW,
  TAIWAN_OVERVIEW_ZOOM,
} from "@/lib/constants";
import { type ManeuverAlertPhase } from "@/lib/maneuver-guidance";
import { approachCameraProgress } from "@/lib/upcoming-route";
import { bindCctvLayerClicks, upsertCctvLayer } from "@/lib/cctv-layer";
import {
  bindConstructionLayerClicks,
  CONSTRUCTION_HIT_LAYER_ID,
  CONSTRUCTION_LAYER_ID,
  upsertConstructionLayer,
} from "@/lib/construction-layer";
import {
  bindParkingLayerClicks,
  PARKING_CLUSTER_LAYER_ID,
  PARKING_HIT_LAYER_ID,
  PARKING_LAYER_ID,
  upsertParkingLayer,
} from "@/lib/parking-layer";
import {
  bindPoiLayerClicks,
  POI_HIT_LAYER_ID,
  POI_LAYER_ID,
  upsertPoiLayer,
} from "@/lib/poi-layer";
import { CCTV_LAYER_HIT_ID, CCTV_LAYER_ID } from "@/lib/cctv-constants";
import type { MapPoiFeature } from "@/lib/map-place";
import {
  ACCIDENT_HIT_LAYER_ID,
  ACCIDENT_LAYER_ID,
  bindAccidentLayerClicks,
  upsertAccidentLayer,
} from "@/lib/event-layer";
import {
  bindDisasterLayerClicks,
  DISASTER_HIT_LAYER_ID,
  DISASTER_LAYER_ID,
  upsertDisasterLayer,
} from "@/lib/disaster-layer";
import {
  clearGuidanceArrows,
  resetGuidanceArrowCache,
  upsertGuidanceArrows,
} from "@/lib/guidance-arrows";
import { upsertIntelligenceLayers } from "@/lib/map-layers";
import { configureMapLibreWorker } from "@/lib/maplibre-worker";
import { formatTaiwanRoadName } from "@/lib/geocoding/format-taiwan-display-address";
import {
  applyResolvedTheme,
  basemapStyle,
  detectAppliedBasemap,
} from "@/lib/map-basemap";
import { resolveMapBasemap } from "@/lib/map-display-mode";
import {
  isLiveStyleGeneration,
  isStaleStyleError,
  waitForBasemapStyle,
} from "@/lib/map-style-switch";
import { damp, distanceKm, headingDelta, lerp, lerpAngle } from "@/lib/geo";
import { subscribeDeviceCompass } from "@/lib/device-compass";
import {
  coneHeadingTarget,
  ensureHeadingConeLayers,
  shouldShowHeadingCone,
  stepConeHeading,
  upsertHeadingCone,
} from "@/lib/heading-cone";
import { easeToRouteOverview } from "@/lib/route-overview";
import { createRouteProgressModel } from "@/lib/route-progress";
import {
  createVehicleDisplayState,
  presentationFollowTau,
  stepVehicleDisplay,
  type VehicleDisplayState,
} from "@/lib/vehicle-display";
import { upsertSpeedEnforcementLayer } from "@/lib/speed-enforcement-layer";
import { peekLastGpsFix } from "@/services/geolocation";
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
  vehicleLiveRef?: MutableRefObject<VehiclePose>;
  displayVehicleLiveRef?: MutableRefObject<DisplayPose | null>;
  cameraMode: CameraMode;
  followOrientation?: FollowOrientation;
  followVehicle: boolean;
  mapDisplayMode?: MapDisplayMode;
  styleRevision?: number;
  pickMode?: boolean;
  navigating: boolean;
  rerouting?: boolean;
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
  mapPois?: MapPoiFeature[];
  selectedPoiId?: string | null;
  layerVisibility?: LayerKindVisibility;
  focusTarget?: MapFocusTarget | null;
  route: [number, number][];
  routeMeters: number;
  distanceToNextMeters: number;
  approachingIntersection: boolean;
  junctionCue?: LngLat | null;
  isTurnManeuver?: boolean;
  maneuverCueMeters?: number;
  maneuverStepId?: string | null;
  maneuverAlertPhase?: ManeuverAlertPhase;
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
  onPoiSelect?: (poiId: string) => void;
  onEmptyMapClick?: (location: { lng: number; lat: number }) => void;
  onUserPan: () => void;
  onViewportChange: (viewport: MapViewport) => void;
  onLongPress?: (location: { lng: number; lat: number }) => void;
  onPickLocation?: (location: { lng: number; lat: number }) => void;
  onStyleApplied?: (mode: MapDisplayMode) => void;
  onStyleFallback?: (message: string) => void;
};

function isCompactViewport(width: number) {
  return width < 640;
}

function isStyleReady(map: MapLibreMap | null): map is MapLibreMap {
  try {
    return Boolean(map && map.isStyleLoaded());
  } catch {
    return false;
  }
}

function routeGeometrySignature(route: [number, number][]) {
  if (route.length < 2) return "empty";
  const first = route[0];
  const last = route[route.length - 1];
  return `${route.length}:${first[0].toFixed(5)},${first[1].toFixed(5)}:${last[0].toFixed(5)},${last[1].toFixed(5)}`;
}

function drivingPadding(
  height: number,
  width: number,
  mode: CameraMode,
  navigating = false,
  overlay?: DrivingMapProps["overlayPadding"],
) {
  const compact = isCompactViewport(width);
  const portrait = height > width;
  const landscape = !portrait;
  const portrait2dNav = navigating && mode === "2d" && portrait;
  const landscapeNav = navigating && landscape;
  const bottomPad = navigating
    ? Math.max(
        portrait2dNav ? 132 : compact ? 72 : 84,
        Math.round(height * (portrait2dNav ? 0.2 : compact ? 0.16 : 0.14)),
      )
    : compact
      ? 96
      : 118;
  /** 預設左右對稱 12。Landscape 導航才用 padding 把車頭移到約 70% x。 */
  let leftPad = 12;
  let rightPad = 12;
  if (landscapeNav) {
    rightPad = 12;
    leftPad = Math.round(12 + width * (2 * NAV_LANDSCAPE_VEHICLE_X - 1));
    leftPad = Math.max(12, Math.min(leftPad, Math.round(width * 0.42)));
  }
  const vehicleY = landscapeNav
    ? NAV_LANDSCAPE_VEHICLE_Y
    : navigating && mode === "3d"
      ? NAV_VEHICLE_Y
      : portrait2dNav
        ? NAV_2D_PORTRAIT_VEHICLE_Y
        : BROWSE_VEHICLE_Y;
  const topPad =
    mode !== "3d" && !portrait2dNav && !landscapeNav
      ? compact
        ? 108
        : 96
      : Math.max(
          Math.round(height * (2 * vehicleY - 1) + bottomPad),
          compact ? 96 : 80,
        );
  if (!navigating || !overlay) {
    return {
      top: topPad,
      bottom: bottomPad,
      left: leftPad,
      right: rightPad,
    };
  }
  return {
    top: Math.max(topPad, overlay.top),
    bottom: Math.max(bottomPad, overlay.bottom),
    left: leftPad,
    right: rightPad,
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
  recoverBlend = 0,
  compassHeading: number | null = null,
) {
  const height = map.getContainer().clientHeight;
  const width = map.getContainer().clientWidth;
  const compact = isCompactViewport(width);
  const portrait = height > width;
  const portrait2dNav = navigating && mode === "2d" && portrait;
  const approachBlend = navigating
    ? approachCameraProgress(distanceToNext, portrait)
    : 0;
  const blend = Math.max(approachBlend, recoverBlend);
  const cruiseZoom =
    mode === "3d"
      ? portrait
        ? navigating
          ? DRIVING_ZOOM_PORTRAIT
          : DRIVING_ZOOM_MOBILE
        : compact
          ? DRIVING_ZOOM_MOBILE
          : DRIVING_ZOOM
      : compact
        ? OVERHEAD_NAV_ZOOM_MOBILE
        : OVERHEAD_NAV_ZOOM;
  const focusZoom =
    mode === "3d"
      ? portrait
        ? INTERSECTION_ZOOM_PORTRAIT
        : compact
          ? INTERSECTION_ZOOM_MOBILE
          : INTERSECTION_ZOOM
      : portrait2dNav
        ? OVERHEAD_TURN_ZOOM_PORTRAIT
        : compact
          ? OVERHEAD_TURN_ZOOM_MOBILE
          : OVERHEAD_TURN_ZOOM;
  const navZoom = lerp(cruiseZoom, focusZoom, blend);
  const cruisePitch = navigating
    ? portrait
      ? NAVIGATION_PITCH_PORTRAIT
      : NAVIGATION_PITCH
    : DRIVING_PITCH;
  const focusPitch = portrait ? INTERSECTION_PITCH_PORTRAIT : INTERSECTION_PITCH;
  const towardCue =
    approaching && junctionCue && blend > (portrait2dNav ? 0.18 : 0.35)
      ? blend * (portrait2dNav ? 0.46 : 0.28)
      : 0;
  return {
    center: [
      lerp(vehicle.lng, junctionCue?.lng ?? vehicle.lng, towardCue),
      lerp(vehicle.lat, junctionCue?.lat ?? vehicle.lat, towardCue),
    ] as [number, number],
    bearing:
      followOrientation === "heading-up"
        ? vehicle.heading
        : compassHeading ?? 0,
    pitch: mode === "3d" ? lerp(cruisePitch, focusPitch, blend) : 0,
    zoom: navigating || mode === "3d" ? navZoom : OVERHEAD_ZOOM,
    padding: drivingPadding(height, width, mode, navigating, overlay),
    blend,
  };
}

function recoverBlendAt(now: number, until: number, from: number) {
  if (until <= now || from <= 0) return 0;
  const remaining = Math.max(0, Math.min(1, (until - now) / MANEUVER_RECOVER_MS));
  return from * remaining * remaining;
}

function currentManeuverOverlay() {
  return [] as [number, number][];
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
  vehicleLiveRef,
  displayVehicleLiveRef,
  cameraMode,
  followOrientation = "heading-up",
  followVehicle,
  mapDisplayMode = "dark",
  styleRevision = 0,
  pickMode = false,
  navigating,
  rerouting = false,
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
  mapPois = [],
  selectedPoiId = null,
  layerVisibility = DEFAULT_LAYER_VISIBILITY,
  focusTarget = null,
  route,
  routeMeters,
  distanceToNextMeters,
  approachingIntersection,
  junctionCue = null,
  isTurnManeuver = false,
  maneuverCueMeters = 0,
  maneuverStepId = null,
  maneuverAlertPhase = "cruise",
  destination,
  overlayPadding = null,
  fitRouteKey,
  onCctvSelect,
  onDisasterSelect,
  onAccidentSelect,
  onConstructionSelect,
  onParkingSelect,
  onPoiSelect,
  onEmptyMapClick,
  onUserPan,
  onViewportChange,
  onLongPress,
  onPickLocation,
  onStyleApplied,
  onStyleFallback,
}: DrivingMapProps) {
  const bootGps = peekLastGpsFix();
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
  const onPoiSelectRef = useRef(onPoiSelect);
  const onEmptyMapClickRef = useRef(onEmptyMapClick);
  const onUserPanRef = useRef(onUserPan);
  const onViewportChangeRef = useRef(onViewportChange);
  const onLongPressRef = useRef(onLongPress);
  const onPickLocationRef = useRef(onPickLocation);
  const onStyleAppliedRef = useRef(onStyleApplied);
  const onStyleFallbackRef = useRef(onStyleFallback);
  const styleGenerationRef = useRef(0);
  const modeRef = useRef(cameraMode);
  const followOrientationRef = useRef(followOrientation);
  const pickModeRef = useRef(pickMode);
  const mapDisplayModeRef = useRef(mapDisplayMode);
  const pickMarkerRef = useRef<Marker | null>(null);
  const styleKeyRef = useRef(resolveMapBasemap(mapDisplayMode));
  const inFlightStyleRef = useRef<string | null>(null);
  const vehicleRef = useRef(vehicle);
  const displayVehicleRef = useRef(displayVehicle);
  const displayStateRef = useRef<VehicleDisplayState>(
    createVehicleDisplayState(bootGps ?? displayVehicle ?? vehicle),
  );
  const lastFixKeyRef = useRef(
    `${(bootGps ?? vehicle).lng},${(bootGps ?? vehicle).lat}`,
  );
  const lastFixAtRef = useRef(0);
  const routeModelRef = useRef(createRouteProgressModel(route, []));
  const routeRef = useRef(route);
  const routeSigRef = useRef("");
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
  const mapPoisRef = useRef(mapPois);
  const selectedPoiRef = useRef(selectedPoiId);
  const selectedDisasterRef = useRef(selectedDisasterId);
  const selectedAccidentRef = useRef(selectedAccidentId);
  const selectedConstructionRef = useRef(selectedConstructionId);
  const layerVisibilityRef = useRef(layerVisibility);
  const followVehicleRef = useRef(followVehicle);
  const navigatingRef = useRef(navigating);
  const routePreviewRef = useRef(
    Boolean(destination && !navigating && route.length >= 2),
  );
  const reroutingRef = useRef(rerouting);
  const approachingRef = useRef(approachingIntersection);
  const junctionCueRef = useRef(junctionCue);
  const isTurnRef = useRef(isTurnManeuver);
  const cueMetersRef = useRef(maneuverCueMeters);
  const stepIdRef = useRef(maneuverStepId);
  const alertPhaseRef = useRef(maneuverAlertPhase);
  const recoverUntilRef = useRef(0);
  const recoverFromRef = useRef(0);
  const lastStepIdRef = useRef(maneuverStepId);
  const lastBlendRef = useRef(0);
  const routeMetersRef = useRef(routeMeters);
  const distanceToNextRef = useRef(distanceToNextMeters);
  const pinchingRef = useRef(false);
  const interactingRef = useRef(false);
  const lastNavigatingMarkerRef = useRef<boolean | null>(null);
  const lastConeAtRef = useRef(0);
  const lastConeKeyRef = useRef("");
  const coneHeadingRef = useRef<number | null>(null);
  const deviceCompassRef = useRef<number | null>(null);
  const lastIntelAtRef = useRef(0);
  const lastIntelKeyRef = useRef("");
  const userZoomRef = useRef<number | null>(null);
  const overlayPaddingRef = useRef(overlayPadding);
  const lastArrowUpdateRef = useRef(0);
  const readyRef = useRef(false);
  const lastFrameRef = useRef(0);
  const markerRotationRef = useRef((bootGps ?? vehicle).heading);
  const cameraCompassRef = useRef<number | null>(null);
  const acquiredGpsRef = useRef(bootGps != null);
  const lastViewportEmitRef = useRef(0);
  const lastEmittedZoomRef = useRef(0);
  const rafRef = useRef(0);

  useEffect(
    () =>
      subscribeDeviceCompass((heading) => {
        deviceCompassRef.current = heading;
      }),
    [],
  );

  useEffect(() => {
    onCctvSelectRef.current = onCctvSelect;
    onDisasterSelectRef.current = onDisasterSelect;
    onAccidentSelectRef.current = onAccidentSelect;
    onConstructionSelectRef.current = onConstructionSelect;
    onParkingSelectRef.current = onParkingSelect;
    onPoiSelectRef.current = onPoiSelect;
    onEmptyMapClickRef.current = onEmptyMapClick;
    onUserPanRef.current = onUserPan;
    onViewportChangeRef.current = onViewportChange;
    onLongPressRef.current = onLongPress;
    onPickLocationRef.current = onPickLocation;
    onStyleAppliedRef.current = onStyleApplied;
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
    }
    const nextPose = displayVehicle ?? vehicle;
    if (vehicle.source === "gps") {
      const jumpMeters =
        distanceKm(displayStateRef.current, nextPose) * 1000;
      if (!acquiredGpsRef.current || jumpMeters > 250) {
        displayStateRef.current = createVehicleDisplayState(nextPose);
      }
    }
    routeRef.current = route;
    const routeSig = routeGeometrySignature(route);
    if (routeSig !== routeSigRef.current) {
      routeSigRef.current = routeSig;
      resetGuidanceArrowCache();
      recoverUntilRef.current = 0;
      const jumpMeters =
        distanceKm(displayStateRef.current, nextPose) * 1000;
      if (jumpMeters > 35) {
        displayStateRef.current = createVehicleDisplayState(nextPose);
      }
    }
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
    mapPoisRef.current = mapPois;
    selectedPoiRef.current = selectedPoiId;
    selectedDisasterRef.current = selectedDisasterId;
    selectedAccidentRef.current = selectedAccidentId;
    selectedConstructionRef.current = selectedConstructionId;
    layerVisibilityRef.current = layerVisibility;
    navigatingRef.current = navigating;
    followVehicleRef.current = followVehicle;
    routePreviewRef.current = Boolean(
      destination && !navigating && route.length >= 2,
    );
    reroutingRef.current = rerouting;
    approachingRef.current = approachingIntersection;
    junctionCueRef.current = junctionCue;
    isTurnRef.current = isTurnManeuver;
    cueMetersRef.current = maneuverCueMeters;
    stepIdRef.current = maneuverStepId;
    alertPhaseRef.current = maneuverAlertPhase;
    routeMetersRef.current = routeMeters;
    distanceToNextRef.current = distanceToNextMeters;
    overlayPaddingRef.current = overlayPadding;
  }, [
    onCctvSelect,
    onDisasterSelect,
    onAccidentSelect,
    onConstructionSelect,
    onParkingSelect,
    onPoiSelect,
    onEmptyMapClick,
    onUserPan,
    onViewportChange,
    onLongPress,
    onPickLocation,
    onStyleApplied,
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
    mapPois,
    selectedPoiId,
    layerVisibility,
    navigating,
    rerouting,
    approachingIntersection,
    junctionCue,
    isTurnManeuver,
    maneuverCueMeters,
    maneuverStepId,
    maneuverAlertPhase,
    routeMeters,
    distanceToNextMeters,
    overlayPadding,
    destination,
    followVehicle,
  ]);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    configureMapLibreWorker();

    const startPose = peekLastGpsFix();
    acquiredGpsRef.current = startPose != null;
    const map = new MapLibreMap({
      container: containerRef.current,
      style: basemapStyle(resolveMapBasemap(mapDisplayMode)),
      center: startPose
        ? [startPose.lng, startPose.lat]
        : [TAIWAN_OVERVIEW.lng, TAIWAN_OVERVIEW.lat],
      zoom: startPose ? DRIVING_ZOOM : TAIWAN_OVERVIEW_ZOOM,
      pitch: startPose ? DRIVING_PITCH : 0,
      bearing: startPose ? startPose.heading : 0,
      maxPitch: 80,
      attributionControl: false,
      fadeDuration: 0,
      dragPan: {
        linearity: 0.28,
        maxSpeed: 1200,
        deceleration: 3000,
      },
      scrollZoom: true,
      touchZoomRotate: true,
      doubleClickZoom: true,
      cooperativeGestures: false,
    });

    mapRef.current = map;

    const vehicleEl = createVehicleMarkerElement();
    setVehicleMarkerVisible(vehicleEl, startPose != null);
    vehicleMarkerRef.current = new Marker({
      element: vehicleEl,
      anchor: "center",
      offset: [0, 0],
      pitchAlignment: "map",
      rotationAlignment: "map",
    })
      .setLngLat(
        startPose
          ? [startPose.lng, startPose.lat]
          : [TAIWAN_OVERVIEW.lng, TAIWAN_OVERVIEW.lat],
      )
      .addTo(map);

    const emitViewport = (force = false) => {
      if (!readyRef.current) return;
      if (!force && (interactingRef.current || pinchingRef.current)) return;
      const now = performance.now();
      const currentZoom = map.getZoom();
      const zoomJump = Math.abs(currentZoom - lastEmittedZoomRef.current);
      if (
        !force &&
        followVehicleRef.current &&
        zoomJump < 0.18 &&
        now - lastViewportEmitRef.current < 800
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

      const raw = vehicleLiveRef?.current ?? vehicleRef.current;
      const snapTarget = displayVehicleLiveRef
        ? displayVehicleLiveRef.current
        : displayVehicleRef.current;
      const target = snapTarget ?? raw;
      const fixKey = `${raw.lng.toFixed(6)},${raw.lat.toFixed(6)}`;
      if (fixKey !== lastFixKeyRef.current) {
        lastFixKeyRef.current = fixKey;
        lastFixAtRef.current = now;
      }
      let snapToFix = false;
      if (raw.source === "gps" && !acquiredGpsRef.current) {
        acquiredGpsRef.current = true;
        displayStateRef.current = createVehicleDisplayState(target);
        snapToFix = true;
      } else {
        displayStateRef.current = stepVehicleDisplay({
          current: displayStateRef.current,
          target,
          raw,
          model: routeModelRef.current,
          navigating: navigatingRef.current,
          dtSeconds: dt,
          elapsedSinceFixSeconds: Math.max(0, (now - lastFixAtRef.current) / 1000),
        });
      }
      const display = displayStateRef.current;
      const showVehicle = raw.source === "gps";
      setVehicleMarkerVisible(marker.getElement(), showVehicle);
      marker.setLngLat([display.lng, display.lat]);

      const headingUp = followOrientationRef.current === "heading-up";
      const navigatingNow = navigatingRef.current;
      if (lastNavigatingMarkerRef.current !== navigatingNow) {
        lastNavigatingMarkerRef.current = navigatingNow;
        setVehicleMarkerNavigating(marker.getElement(), navigatingNow);
      }

      const gestureBusy = interactingRef.current || pinchingRef.current;
      let coneHeadingForMarker: number | null = null;
      try {
        const showCone = shouldShowHeadingCone({
          navigating: navigatingRef.current,
          rerouting: reroutingRef.current,
          source: raw.source,
          headingAvailable: raw.headingAvailable,
          compassAvailable: deviceCompassRef.current != null,
        });
        const coneTarget = coneHeadingTarget({
          gpsHeading: raw.heading,
          headingAvailable: raw.headingAvailable,
          compassHeading: deviceCompassRef.current,
          speedMps: raw.speedMps,
          fallbackHeading: display.heading,
        });
        coneHeadingRef.current =
          coneHeadingRef.current == null || snapToFix
            ? coneTarget
            : stepConeHeading(
                coneHeadingRef.current,
                coneTarget,
                dt,
                raw.speedMps ?? 0,
              );
        const coneHeading = coneHeadingRef.current;
        if (showCone) coneHeadingForMarker = coneHeading;
        const coneZoom = mapNow.getZoom();
        const coneRenderHeading = Math.round(coneHeading);
        const coneKey = showCone
          ? `${display.lng.toFixed(5)},${display.lat.toFixed(5)},${coneRenderHeading},${coneZoom.toFixed(2)}`
          : "off";
        if (
          !gestureBusy &&
          coneKey !== lastConeKeyRef.current &&
          now - lastConeAtRef.current >= 16
        ) {
          lastConeAtRef.current = now;
          lastConeKeyRef.current = coneKey;
          ensureHeadingConeLayers(mapNow);
          upsertHeadingCone(
            mapNow,
            showCone ? { lng: display.lng, lat: display.lat } : null,
            coneRenderHeading,
            showCone,
            coneZoom,
          );
        }
      } catch {
        /* style may still be swapping */
      }

      if (navigatingRef.current) {
        const stepId = stepIdRef.current;
        if (stepId !== lastStepIdRef.current) {
          const consecutive =
            isTurnRef.current &&
            distanceToNextRef.current <= CONSECUTIVE_TURN_METERS;
          if (consecutive) {
            recoverUntilRef.current = 0;
          } else if (lastBlendRef.current > 0.05) {
            recoverUntilRef.current = now + MANEUVER_RECOVER_MS;
            recoverFromRef.current = lastBlendRef.current;
          }
          lastStepIdRef.current = stepId;
        }
        if (!gestureBusy && now - lastArrowUpdateRef.current > 48) {
          lastArrowUpdateRef.current = now;
          try {
            upsertGuidanceArrows(
              mapNow,
              routeRef.current,
              routeMetersRef.current,
              distanceToNextRef.current,
              true,
              (now / 1600) % 1,
              {
                cameraMode: modeRef.current,
                isTurn: isTurnRef.current,
                cueMeters: cueMetersRef.current,
                fade: recoverBlendAt(
                  now,
                  recoverUntilRef.current,
                  recoverFromRef.current,
                ),
              },
            );
          } catch {
            /* style may still be swapping */
          }
        }
      } else {
        lastStepIdRef.current = stepIdRef.current;
        recoverUntilRef.current = 0;
        if (lastArrowUpdateRef.current !== 0) {
          lastArrowUpdateRef.current = 0;
          try {
            upsertGuidanceArrows(mapNow, [], 0, 0, false, 0);
          } catch {
            /* style may still be swapping */
          }
        }
      }

      const intelKey = `${routeSigRef.current}:${Math.round((navigatingRef.current ? routeMetersRef.current : 0) / 40)}:${trafficRef.current.length}:${layerVisibilityRef.current.congestion}`;
      if (
        !gestureBusy &&
        intelKey !== lastIntelKeyRef.current &&
        now - lastIntelAtRef.current > 400
      ) {
        lastIntelKeyRef.current = intelKey;
        lastIntelAtRef.current = now;
        try {
          upsertIntelligenceLayers(
            mapNow,
            routeRef.current,
            trafficRef.current,
            layerVisibilityRef.current.congestion,
            navigatingRef.current ? routeMetersRef.current : 0,
            currentManeuverOverlay(),
          );
        } catch {
          /* remaining-route slice is presentation only */
        }
      }

      if (
        !routePreviewRef.current &&
        showVehicle &&
        (followVehicleRef.current || snapToFix) &&
        !gestureBusy
      ) {
        const displayPose = {
          ...raw,
          lng: display.lng,
          lat: display.lat,
          heading: display.heading,
        };
        const recoverBlend = recoverBlendAt(
          now,
          recoverUntilRef.current,
          recoverFromRef.current,
        );
        const northUp = !headingUp;
        if (northUp) {
          const compassRaw = deviceCompassRef.current;
          cameraCompassRef.current =
            compassRaw == null
              ? cameraCompassRef.current
              : cameraCompassRef.current == null || snapToFix
                ? compassRaw
                : stepConeHeading(
                    cameraCompassRef.current,
                    compassRaw,
                    dt,
                    raw.speedMps ?? 0,
                  );
        }
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
          recoverBlend,
          northUp ? cameraCompassRef.current : null,
        );
        lastBlendRef.current = wanted.blend;
        const center = mapNow.getCenter();
        const zoomTarget = pinchingRef.current
          ? mapNow.getZoom()
          : (userZoomRef.current ?? wanted.zoom);
        const followTau = presentationFollowTau(raw.speedMps ?? 0, wanted.blend);
        const posT = snapToFix ? 1 : damp(dt, followTau.posTau);
        const zoomT = pinchingRef.current ? 0 : snapToFix ? 1 : damp(dt, followTau.zoomTau);
        const currentBearing = mapNow.getBearing();
        const bearingTau = northUp ? 0.07 : followTau.bearingTau;
        const bearingHoldDeg = northUp ? 2.2 : followTau.bearingHoldDeg;
        const bearingGap = headingDelta(currentBearing, wanted.bearing);
        const nextBearing =
          snapToFix
            ? wanted.bearing
            : bearingGap < bearingHoldDeg
              ? currentBearing
              : lerpAngle(
                  currentBearing,
                  wanted.bearing,
                  damp(dt, bearingTau),
                );
        try {
          mapNow.jumpTo({
            center: snapToFix
              ? wanted.center
              : [
                  lerp(center.lng, wanted.center[0], posT),
                  lerp(center.lat, wanted.center[1], posT),
                ],
            bearing: nextBearing,
            pitch: snapToFix
              ? wanted.pitch
              : lerp(mapNow.getPitch(), wanted.pitch, damp(dt, 0.08)),
            zoom: snapToFix ? zoomTarget : lerp(mapNow.getZoom(), zoomTarget, zoomT),
            padding: wanted.padding,
          });
        } catch {
          /* style may still be swapping */
        }
        emitViewport();
      }

      if (coneHeadingForMarker != null) {
        const markerHeading = Math.round(coneHeadingForMarker);
        const markerGap = headingDelta(markerRotationRef.current, markerHeading);
        markerRotationRef.current =
          markerGap < 2
            ? markerRotationRef.current
            : markerHeading;
      } else {
        const rotationTarget =
          headingUp && followVehicleRef.current
            ? mapNow.getBearing()
            : display.heading;
        const markerGap = headingDelta(markerRotationRef.current, rotationTarget);
        markerRotationRef.current =
          markerGap < 2.2
            ? markerRotationRef.current
            : lerpAngle(
                markerRotationRef.current,
                rotationTarget,
                damp(dt, 0.24),
              );
      }
      marker.setRotation(markerRotationRef.current);
      setVehicleMarkerHeading(marker.getElement(), markerRotationRef.current);

      rafRef.current = requestAnimationFrame(tick);
    };

    const attachCustomLayers = () => {
      if (!isStyleReady(map)) return;
      const visible = layerVisibilityRef.current;
      try {
        applyResolvedTheme(map, styleKeyRef.current);
        ensureHeadingConeLayers(map);
        upsertIntelligenceLayers(
          map,
          routeRef.current,
          trafficRef.current,
          visible.congestion,
          routeMetersRef.current,
          currentManeuverOverlay(),
        );
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
        upsertPoiLayer(map, mapPoisRef.current);
        bindPoiLayerClicks(map, (id) => onPoiSelectRef.current?.(id));
        upsertGuidanceArrows(
          map,
          routeRef.current,
          routeMetersRef.current,
          distanceToNextRef.current,
          navigatingRef.current,
          0,
          {
            cameraMode: modeRef.current,
            isTurn: isTurnRef.current,
            cueMeters: cueMetersRef.current,
          },
        );
      } catch (error) {
        console.error("Event layer skipped", error);
      }
    };

    const markReady = () => {
      attachCustomLayers();
      if (readyRef.current) return;
      readyRef.current = true;
      try {
        if (vehicleRef.current.source === "gps") {
          acquiredGpsRef.current = true;
          map.jumpTo(
            cameraOptions(
              map,
              vehicleRef.current,
              modeRef.current,
              navigatingRef.current,
              approachingRef.current,
              overlayPaddingRef.current,
              distanceToNextRef.current,
              junctionCueRef.current,
              followOrientationRef.current,
              0,
              followOrientationRef.current === "north-up"
                ? cameraCompassRef.current
                : null,
            ),
          );
        }
      } catch {
        /* camera restore is optional until the next frame */
      }
      emitViewport(true);
      lastFrameRef.current = performance.now();
      rafRef.current = requestAnimationFrame(tick);
    };

    const onMapClick = (event: {
      lngLat: { lng: number; lat: number };
      point: { x: number; y: number };
    }) => {
      if (pickModeRef.current) {
        const { lng, lat } = event.lngLat;
        pickMarkerRef.current?.remove();
        pickMarkerRef.current = new Marker({ color: "#22d3ee", anchor: "bottom" })
          .setLngLat([lng, lat])
          .addTo(map);
        onPickLocationRef.current?.({ lng, lat });
        return;
      }
      const candidateLayers = [
        PARKING_HIT_LAYER_ID,
        PARKING_LAYER_ID,
        PARKING_CLUSTER_LAYER_ID,
        CCTV_LAYER_HIT_ID,
        CCTV_LAYER_ID,
        ACCIDENT_HIT_LAYER_ID,
        ACCIDENT_LAYER_ID,
        CONSTRUCTION_HIT_LAYER_ID,
        CONSTRUCTION_LAYER_ID,
        DISASTER_HIT_LAYER_ID,
        DISASTER_LAYER_ID,
        POI_HIT_LAYER_ID,
        POI_LAYER_ID,
      ].filter((id) => map.getLayer(id));
      const hits = candidateLayers.length
        ? map.queryRenderedFeatures([event.point.x, event.point.y], {
            layers: candidateLayers,
          })
        : [];
      if (hits.length) {
        const poiHit = hits.find(
          (feature) =>
            feature.layer.id === POI_HIT_LAYER_ID ||
            feature.layer.id === POI_LAYER_ID,
        );
        const occupied = hits.some(
          (feature) =>
            feature.layer.id !== POI_HIT_LAYER_ID &&
            feature.layer.id !== POI_LAYER_ID,
        );
        if (!occupied && poiHit && typeof poiHit.properties?.id === "string") {
          onPoiSelectRef.current?.(poiHit.properties.id);
        }
        return;
      }
      onEmptyMapClickRef.current?.(event.lngLat);
    };
    map.on("style.load", markReady);
    map.on("load", markReady);
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
    const beginGesture = () => {
      interactingRef.current = true;
    };
    const detachFollow = () => {
      beginGesture();
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
      }, 620);
    };
    const onTouchStart = (event: TouchEvent) => {
      beginGesture();
      if (event.touches.length >= 2) {
        pinchingRef.current = true;
        cancelPress();
        detachFollow();
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
      window.setTimeout(() => {
        if (!map.isMoving()) interactingRef.current = false;
      }, 90);
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
      if (event.originalEvent) {
        pinchingRef.current = true;
        beginGesture();
      }
    });
    map.on("wheel", () => {
      pinchingRef.current = true;
      beginGesture();
      window.setTimeout(() => {
        rememberZoom();
        pinchingRef.current = false;
        if (!map.isMoving()) interactingRef.current = false;
      }, 180);
    });
    map.on("dragstart", (event) => {
      beginGesture();
      if (
        event.originalEvent instanceof TouchEvent &&
        event.originalEvent.touches.length >= 2
      ) {
        pinchingRef.current = true;
        detachFollow();
        return;
      }
      detachFollow();
    });
    map.on("rotatestart", (event) => {
      if (event.originalEvent) detachFollow();
    });
    map.on("pitchstart", (event) => {
      if (event.originalEvent) detachFollow();
    });
    map.on("zoomend", () => {
      if (pinchingRef.current) rememberZoom();
    });
    map.on("moveend", () => {
      const wasGesture = interactingRef.current || pinchingRef.current;
      interactingRef.current = false;
      pinchingRef.current = false;
      emitViewport(wasGesture || !followVehicleRef.current);
    });
    map.on("idle", () => {
      interactingRef.current = false;
      pinchingRef.current = false;
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
    if (!readyRef.current || !isStyleReady(map)) return;
    if (interactingRef.current || pinchingRef.current) return;
    lastIntelAtRef.current = performance.now();
    lastIntelKeyRef.current = `${routeGeometrySignature(route)}:${Math.round((navigating ? routeMeters : 0) / 40)}:${traffic.length}:${layerVisibility.congestion}`;
    upsertIntelligenceLayers(
      map,
      route,
      traffic,
      layerVisibility.congestion,
      navigating ? routeMeters : 0,
      currentManeuverOverlay(),
    );
    if (!navigating) {
      clearGuidanceArrows(map);
    }
    // routeMeters is applied from the rAF tick so GPS progress does not rebuild GeoJSON.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layerVisibility.congestion, navigating, route, traffic]);

  useEffect(() => {
    followVehicleRef.current = followVehicle;
    if (followVehicle) userZoomRef.current = null;
  }, [followVehicle]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !readyRef.current) return;
    const requestedMode = mapDisplayMode;
    const resolved = resolveMapBasemap(requestedMode);
    if (resolved === styleKeyRef.current && inFlightStyleRef.current == null) {
      onStyleAppliedRef.current?.(requestedMode);
      return;
    }

    const generation = styleGenerationRef.current + 1;
    styleGenerationRef.current = generation;
    inFlightStyleRef.current = resolved;
    const isCurrent = () =>
      isLiveStyleGeneration(styleGenerationRef.current, generation);
    const camera = {
      center: map.getCenter(),
      zoom: map.getZoom(),
      pitch: map.getPitch(),
      bearing: map.getBearing(),
    };

    const restoreCameraAndMarkers = () => {
      try {
        if (vehicleRef.current.source !== "gps") {
          map.jumpTo(camera);
        } else {
          const display = displayStateRef.current;
          const wanted = cameraOptions(
            map,
            {
              ...vehicleRef.current,
              lng: display.lng,
              lat: display.lat,
              heading: display.heading,
            },
            modeRef.current,
            navigatingRef.current,
            approachingRef.current,
            overlayPaddingRef.current,
            distanceToNextRef.current,
            junctionCueRef.current,
            followOrientationRef.current,
            0,
            followOrientationRef.current === "north-up"
              ? cameraCompassRef.current
              : null,
          );
          map.jumpTo({
            center: wanted.center,
            bearing: wanted.bearing,
            pitch: wanted.pitch,
            zoom: wanted.zoom,
            padding: wanted.padding,
          });
        }
      } catch {
        try {
          map.jumpTo(camera);
        } catch {
          /* keep the newly loaded style even if camera restore fails */
        }
      }
      if (vehicleMarkerRef.current) vehicleMarkerRef.current.addTo(map);
      if (destMarkerRef.current) destMarkerRef.current.addTo(map);
    };

    const finishSuccess = () => {
      if (!isCurrent() || !isStyleReady(map)) return;
      if (detectAppliedBasemap(map) !== resolved) return;
      styleKeyRef.current = resolved;
      inFlightStyleRef.current = null;
      try {
        applyResolvedTheme(map, resolved);
        const visible = layerVisibilityRef.current;
        ensureHeadingConeLayers(map);
        upsertIntelligenceLayers(
          map,
          routeRef.current,
          trafficRef.current,
          visible.congestion,
          routeMetersRef.current,
          currentManeuverOverlay(),
        );
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
        upsertPoiLayer(map, mapPoisRef.current);
        bindPoiLayerClicks(map, (id) => onPoiSelectRef.current?.(id));
        upsertGuidanceArrows(
          map,
          routeRef.current,
          routeMetersRef.current,
          distanceToNextRef.current,
          navigatingRef.current,
          0,
          {
            cameraMode: modeRef.current,
            isTurn: isTurnRef.current,
            cueMeters: cueMetersRef.current,
          },
        );
      } catch (error) {
        console.error("Navigation overlays remount skipped", error);
      }
      restoreCameraAndMarkers();
      onStyleAppliedRef.current?.(requestedMode);
    };

    let cancelled = false;
    const pending = waitForBasemapStyle(
      map,
      () => isCurrent() && !cancelled,
      resolved,
    );
    try {
      map.setStyle(basemapStyle(resolved), { diff: false });
    } catch {
      pending.cancel();
      if (!cancelled && isCurrent()) {
        inFlightStyleRef.current = null;
        onStyleFallbackRef.current?.("衛星或底圖載入失敗，已保留上一個有效圖層。");
      }
      return () => {
        cancelled = true;
        pending.cancel();
      };
    }

    void pending.promise
      .then(() => {
        if (cancelled || !isCurrent()) return;
        finishSuccess();
      })
      .catch((error: unknown) => {
        if (cancelled || isStaleStyleError(error) || !isCurrent()) return;
        inFlightStyleRef.current = null;
        onStyleFallbackRef.current?.("衛星或底圖載入失敗，已保留上一個有效圖層。");
      });

    return () => {
      cancelled = true;
      pending.cancel();
    };
  }, [mapDisplayMode, styleRevision]);

  useEffect(() => {
    if (pickMode) return;
    pickMarkerRef.current?.remove();
    pickMarkerRef.current = null;
  }, [pickMode]);

  useEffect(() => {
    const map = mapRef.current;
    if (!readyRef.current || !isStyleReady(map)) return;
    try {
      upsertCctvLayer(map, cameras, selectedCctvId, layerVisibility.cctv);
    } catch (error) {
      console.error("CCTV layer update skipped", error);
    }
  }, [cameras, layerVisibility.cctv, selectedCctvId]);

  useEffect(() => {
    const map = mapRef.current;
    if (!readyRef.current || !isStyleReady(map)) return;
    upsertDisasterLayer(map, disasters, selectedDisasterId, layerVisibility.disaster);
  }, [disasters, layerVisibility.disaster, selectedDisasterId]);

  useEffect(() => {
    const map = mapRef.current;
    if (!readyRef.current || !isStyleReady(map)) return;
    upsertSpeedEnforcementLayer(map, speedEnforcement);
  }, [speedEnforcement]);

  useEffect(() => {
    const map = mapRef.current;
    if (!readyRef.current || !isStyleReady(map)) return;
    try {
      upsertAccidentLayer(map, accidents, selectedAccidentId, layerVisibility.accident);
    } catch (error) {
      console.error("Accident layer update skipped", error);
    }
  }, [accidents, layerVisibility.accident, selectedAccidentId]);

  useEffect(() => {
    const map = mapRef.current;
    if (!readyRef.current || !isStyleReady(map)) return;
    upsertConstructionLayer(
      map,
      constructions,
      selectedConstructionId,
      layerVisibility.construction,
    );
  }, [constructions, layerVisibility.construction, selectedConstructionId]);

  useEffect(() => {
    const map = mapRef.current;
    if (!readyRef.current || !isStyleReady(map)) return;
    upsertParkingLayer(map, parkingLots, selectedParkingId, parkingVisible);
  }, [parkingLots, parkingVisible, selectedParkingId]);

  useEffect(() => {
    const map = mapRef.current;
    if (!readyRef.current || !isStyleReady(map)) return;
    upsertPoiLayer(map, mapPois);
  }, [mapPois, selectedPoiId]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !readyRef.current || !focusTarget) return;
    const camera = {
      center: [focusTarget.lng, focusTarget.lat] as [number, number],
      zoom: Math.max(map.getZoom(), 16.2),
      essential: true as const,
    };
    if (focusTarget.immediate) {
      map.jumpTo(camera);
      return;
    }
    map.easeTo({
      ...camera,
      duration: 480,
    });
  }, [focusTarget]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    destMarkerRef.current?.remove();
    destMarkerRef.current = null;
    if (!destination) return;
    destMarkerRef.current = new Marker({
        element: createDestinationPin(
          formatTaiwanRoadName(destination.address || destination.label) ||
            destination.label,
        ),
      anchor: "bottom",
    })
      .setLngLat([destination.location.lng, destination.location.lat])
      .addTo(map);
  }, [destination]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !readyRef.current || !fitRouteKey || route.length < 2) return;
    const compact = isCompactViewport(map.getContainer().clientWidth);
    easeToRouteOverview(map, route, cameraMode, {
      top: compact ? 168 : 150,
      bottom: compact ? 120 : 110,
      left: compact ? 48 : 44,
      right: compact ? 48 : 44,
    });
  }, [fitRouteKey, route, cameraMode]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !readyRef.current) return;
    if (followVehicleRef.current) return;
    if (destination && !navigating) return;
    const compact = isCompactViewport(map.getContainer().clientWidth);
    const portrait =
      map.getContainer().clientHeight > map.getContainer().clientWidth;
    const center = map.getCenter();
    const zoom =
      cameraMode === "3d"
        ? portrait && navigating
          ? DRIVING_ZOOM_PORTRAIT
          : compact
            ? DRIVING_ZOOM_MOBILE
            : DRIVING_ZOOM
        : navigating
          ? compact
            ? OVERHEAD_NAV_ZOOM_MOBILE
            : OVERHEAD_NAV_ZOOM
          : OVERHEAD_ZOOM;
    const pitch =
      cameraMode === "3d"
        ? navigating
          ? portrait
            ? NAVIGATION_PITCH_PORTRAIT
            : NAVIGATION_PITCH
          : DRIVING_PITCH
        : 0;
    try {
      map.jumpTo({
        center: [center.lng, center.lat],
        zoom,
        pitch,
        bearing: map.getBearing(),
      });
    } catch {
      /* keep the current frame if the style is swapping */
    }
  }, [cameraMode, navigating, destination, route]);

  return <div ref={containerRef} className="absolute inset-0 h-full w-full touch-none" />;
}
