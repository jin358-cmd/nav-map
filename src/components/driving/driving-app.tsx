"use client";

import dynamic from "next/dynamic";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { MapControls } from "@/components/map/map-controls";
import { AddressSearch } from "@/components/overlay/address-search";
import { PlaceEditor } from "@/components/overlay/place-editor";
import { SavedPlaceBar } from "@/components/overlay/saved-place-bar";
import { CctvDetailCard } from "@/components/overlay/cctv-detail-card";
import {
  EventDetailCard,
  accidentToCard,
  congestionToCard,
  constructionToCard,
  disasterToCard,
} from "@/components/overlay/event-detail-card";
import { EventListPanel } from "@/components/overlay/event-list-panel";
import { ParkingArrivalCard } from "@/components/overlay/parking-arrival-card";
import { PoiLayerBar } from "@/components/overlay/poi-layer-bar";
import { ParkingPanel } from "@/components/overlay/parking-panel";
import { PlaceInfoCard } from "@/components/overlay/place-info-card";
import { NextIntersectionHud } from "@/components/overlay/navigation-banner";
import { RoadInformationCard } from "@/components/overlay/road-information-card";
import { RouteConfirmBar } from "@/components/overlay/route-preview";
import { YouTubeMusicPlayer } from "@/components/overlay/youtube-music-player";
import { useCctvView } from "@/hooks/use-cctv-view";
import { useDisasterView } from "@/hooks/use-disaster-view";
import { useGoogleAccount } from "@/hooks/use-google-account";
import { useLandscape } from "@/hooks/use-landscape";
import { useYoutubeLibrary } from "@/hooks/use-youtube-library";
import { useNavigationVoice } from "@/hooks/use-navigation-voice";
import { useSpeedEnforcementView } from "@/hooks/use-speed-enforcement-view";
import { useMapPois } from "@/hooks/use-map-pois";
import { useLocatedRegion } from "@/hooks/use-located-region";
import { useParkingView } from "@/hooks/use-parking-view";
import { roadIntelFromCameras } from "@/lib/cctv-intel";
import { deriveAccidentIntel, mapVisibleAccidents } from "@/lib/accident-query";
import {
  deriveConstructionIntel,
  mapVisibleConstruction,
} from "@/lib/construction-query";
import { deriveDisasterIntel } from "@/lib/disaster-intel";
import { mapVisibleDisasters } from "@/lib/disaster-query";
import { isDemoDataEnabled } from "@/lib/runtime-demo";
import { rememberAddress } from "@/lib/address-history";
import { segmentAnchor } from "@/lib/traffic-query";
import {
  DEFAULT_POI_LAYER_VISIBILITY,
  isPoiLayerVisible,
  type PoiLayerVisibility,
} from "@/lib/poi/main-layers";
import { isDemoLandmarkPreset } from "@/data/landmarks";
import { formatTaiwanRoadName } from "@/lib/geocoding/format-taiwan-display-address";
import {
  addFavorite,
  getFavoritesSnapshot,
  getServerFavoritesSnapshot,
  isFavorite,
  removeFavorite,
  renameFavorite,
  subscribeFavorites,
} from "@/lib/favorites";
import { pinSelected } from "@/lib/map-visibility";
import { resolveMapQueryOrigin } from "@/lib/map-query-origin";
import {
  deriveManeuverAlertPhase,
  isTurnManeuver,
  maneuverAlertActive,
} from "@/lib/maneuver-guidance";
import { pickActiveRouteAlert } from "@/lib/route-events";
import {
  customPlaceFromLngLat,
  geocodeHitToPlace,
  mapPlaceToHit,
  poiFeatureToPlace,
  type MapPlace,
} from "@/lib/map-place";
import {
  PARKING_CURRENT_LOCATION_RADIUS_M,
  PARKING_DESTINATION_RADIUS_M,
  PARKING_PANEL_REFRESH_MS,
} from "@/lib/parking/constants";
import {
  parkingArrivalPromptEnabled,
  getServerParkingArrivalSnapshot,
  setParkingArrivalPromptEnabled,
  subscribeParkingArrivalPrompt,
} from "@/lib/parking-arrival-setting";
import { destinationToHit } from "@/lib/poi-search";
import { logRerouteTimings } from "@/lib/reroute-metrics";
import {
  DEMO_VEHICLE,
  YOUTUBE_PLAYLISTS,
} from "@/lib/constants";
import { distanceKm } from "@/lib/geo";
import { nextIntersectionStep } from "@/lib/osrm-maneuver";
import {
  createRouteProgressModel,
  updateNavigationProgress,
  type NavigationProgress,
  type NavigationTrackerState,
} from "@/lib/route-progress";
import { snapVehicleToRoute } from "@/lib/route-snap";
import {
  getServerMapDisplayModeSnapshot,
  msUntilAutoSwitch,
  readMapDisplayMode,
  resolveMapBasemap,
  subscribeMapDisplayMode,
  writeMapDisplayMode,
} from "@/lib/map-display-mode";
import {
  deleteSavedPlace,
  findSavedCustomPlace,
  getSavedPlacesSnapshot,
  getServerSavedPlacesSnapshot,
  renameSavedPlace,
  savedPlaceToHit,
  subscribeSavedPlaces,
  upsertSavedPlace,
} from "@/lib/saved-places";
import { GpsFixChip } from "@/components/overlay/gps-fix-chip";
import { MapAttribution } from "@/components/overlay/map-attribution";
import { SpeedHud, SpeedLimitBadge } from "@/components/overlay/speed-hud";
import { TripStatusCluster } from "@/components/overlay/trip-status-cluster";
import { approachingSpeedCameraLimit } from "@/lib/speed-camera-alert";
import {
  fetchAccidentReports,
  planDrivingRoute,
  requestCurrentPosition,
  searchAddresses,
  watchVehiclePosition,
} from "@/services";
import {
  geoErrorCode,
  geoErrorMessage,
  queryGeolocationPermission,
} from "@/services/geolocation";
import { fetchConstructionEvents } from "@/services/construction";
import { reversePlace } from "@/services/routing";
import type {
  AccidentReport,
  CameraMode,
  CctvCamera,
  ConstructionEvent,
  EventDataOrigin,
  GeocodeHit,
  GpsErrorCode,
  GpsPermissionState,
  GpsStatus,
  LayerKindVisibility,
  MapFocusTarget,
  MapViewport,
  NavigationManeuver,
  RoadIntelItem,
  RoadIntelKind,
  DisplayPose,
  FollowOrientation,
  MapDisplayMode,
  ParkingLot,
  ParkingSort,
  RouteDestination,
  RouteStep,
  SavedPlaceType,
  SelectedMapEvent,
  TravelMode,
  VehiclePose,
} from "@/types/domain";

const DEFAULT_LAYER_VISIBILITY: LayerKindVisibility = {
  congestion: false,
  cctv: true,
  construction: true,
  accident: true,
  disaster: true,
};

const SOFT_RESTART_COOLDOWN_MS = 4200;
const SOFT_RESTART_ATTEMPT_GAP_MS = 900;
const PARKING_REMINDER_METERS = 800;
const PARKING_REMINDER_MIN_METERS = 40;
const PARKING_REMINDER_SHRINK_MS = 15_000;

function MapChunkError() {
  return (
    <div className="absolute inset-0 bg-[#0b0d11]">
      <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center text-sm text-zinc-400">
        <p>地圖模組載入失敗，請重新整理。</p>
        <button
          type="button"
          className="rounded-full border border-white/15 bg-white/8 px-4 py-1.5 text-zinc-100"
          onClick={() => window.location.reload()}
        >
          重新載入地圖
        </button>
      </div>
    </div>
  );
}

const DrivingMap = dynamic(
  () =>
    import("@/components/map/driving-map")
      .then((mod) => mod.DrivingMap)
      .catch(() => MapChunkError),
  {
    ssr: false,
    loading: () => (
      <div className="absolute inset-0 bg-[#0b0d11]">
        <div className="flex h-full items-center justify-center text-sm text-zinc-400">
          載入駕駛地圖…
        </div>
      </div>
    ),
  },
);

export function DrivingApp() {
  const [vehicle, setVehicle] = useState<VehiclePose>(DEMO_VEHICLE);
  const [displayVehicle, setDisplayVehicle] = useState<DisplayPose | null>(null);
  const [cameraMode, setCameraMode] = useState<CameraMode>("3d");
  const [followOrientation, setFollowOrientation] =
    useState<FollowOrientation>("heading-up");
  const [followVehicle, setFollowVehicle] = useState(false);
  const [userAdjustedMap, setUserAdjustedMap] = useState(false);
  const mapDisplayMode = useSyncExternalStore(
    subscribeMapDisplayMode,
    readMapDisplayMode,
    getServerMapDisplayModeSnapshot,
  );
  const [pendingMapDisplayMode, setPendingMapDisplayMode] =
    useState<MapDisplayMode | null>(null);
  const [styleMenuOpen, setStyleMenuOpen] = useState(false);
  const [styleRevision, setStyleRevision] = useState(0);
  const [styleHint, setStyleHint] = useState<string | null>(null);
  const [editingPlaceType, setEditingPlaceType] = useState<SavedPlaceType | null>(
    null,
  );
  const [editingPlaceId, setEditingPlaceId] = useState<string | null>(null);
  const [pickMode, setPickMode] = useState(false);
  const [pickLocation, setPickLocation] = useState<{
    lng: number;
    lat: number;
  } | null>(null);
  const [pickAddress, setPickAddress] = useState<string | null>(null);
  const [gpsStatus, setGpsStatus] = useState<GpsStatus>("idle");
  const [gpsError, setGpsError] = useState<GpsErrorCode>(null);
  const [gpsPermission, setGpsPermission] =
    useState<GpsPermissionState>("prompt");
  const [viewport, setViewport] = useState<MapViewport | null>(null);
  const [refreshNonce, setRefreshNonce] = useState(0);
  const [accidents, setAccidents] = useState<AccidentReport[]>([]);
  const [accidentOrigin, setAccidentOrigin] =
    useState<EventDataOrigin>("unavailable");
  const [constructions, setConstructions] = useState<ConstructionEvent[]>([]);
  const [constructionOrigin, setConstructionOrigin] =
    useState<EventDataOrigin>("unavailable");
  const [selectedEvent, setSelectedEvent] = useState<SelectedMapEvent | null>(
    null,
  );
  const [eventListKind, setEventListKind] = useState<RoadIntelKind | null>(null);
  const [layerVisibility, setLayerVisibility] = useState<LayerKindVisibility>(
    DEFAULT_LAYER_VISIBILITY,
  );
  const [poiLayerVisibility, setPoiLayerVisibility] =
    useState<PoiLayerVisibility>(DEFAULT_POI_LAYER_VISIBILITY);
  const [focusTarget, setFocusTarget] = useState<MapFocusTarget | null>(null);
  const [parkingOpen, setParkingOpen] = useState(false);
  const [parkingSort, setParkingSort] = useState<ParkingSort>("distance");
  const [selectedParking, setSelectedParking] = useState<ParkingLot | null>(null);
  const [selectedMapPlace, setSelectedMapPlace] = useState<MapPlace | null>(null);
  const [parkingArrivalOpen, setParkingArrivalOpen] = useState(false);
  const [parkingArrivalMinimized, setParkingArrivalMinimized] = useState(false);
  const [arrivalNotice, setArrivalNotice] = useState<string | null>(null);
  const parkingArrivalEnabled = useSyncExternalStore(
    subscribeParkingArrivalPrompt,
    parkingArrivalPromptEnabled,
    getServerParkingArrivalSnapshot,
  );
  const parkingArrivalDismissedRef = useRef(false);
  const arrivalFiredRef = useRef(false);
  const restartLockRef = useRef(false);
  const [route, setRoute] = useState<[number, number][]>([]);
  const [maneuver, setManeuver] = useState<NavigationManeuver | null>(null);
  const [destination, setDestination] = useState<RouteDestination | null>(null);
  const [routeSteps, setRouteSteps] = useState<RouteStep[]>([]);
  const [routeEpoch, setRouteEpoch] = useState(0);
  const [fitRouteKey, setFitRouteKey] = useState(0);
  const [routing, setRouting] = useState(false);
  const [routeError, setRouteError] = useState<string | null>(null);
  const [travelMode, setTravelMode] = useState<TravelMode>("car");
  const [routeDurationSeconds, setRouteDurationSeconds] = useState<number | null>(
    null,
  );
  const [routeDistanceMeters, setRouteDistanceMeters] = useState<number | null>(
    null,
  );
  const [motorcycleUnsupported, setMotorcycleUnsupported] = useState(false);
  const lastRouteHitRef = useRef<GeocodeHit | null>(null);
  const [baseIntel, setBaseIntel] = useState<RoadIntelItem[]>([]);
  const [selectedCctv, setSelectedCctv] = useState<CctvCamera | null>(null);
  const demoEnabled = isDemoDataEnabled();
  const [navigating, setNavigating] = useState(false);
  const [musicMode, setMusicMode] = useState<"off" | "open" | "mini">("off");
  const [favoritesOpen, setFavoritesOpen] = useState(false);
  const [toolsDrawerOpen, setToolsDrawerOpen] = useState(false);
  const favorites = useSyncExternalStore(
    subscribeFavorites,
    getFavoritesSnapshot,
    getServerFavoritesSnapshot,
  );
  const userFavorites = useMemo(
    () => favorites.filter((hit) => !isDemoLandmarkPreset(hit)),
    [favorites],
  );
  const savedPlaces = useSyncExternalStore(
    subscribeSavedPlaces,
    getSavedPlacesSnapshot,
    getServerSavedPlacesSnapshot,
  );
  const homePlace = savedPlaces.find((place) => place.type === "home") ?? null;
  const workPlace = savedPlaces.find((place) => place.type === "work") ?? null;
  const customPlaces = savedPlaces.filter((place) => place.type === "custom");
  const editingPlace =
    (editingPlaceId
      ? savedPlaces.find((place) => place.id === editingPlaceId)
      : null) ??
    (editingPlaceType && editingPlaceType !== "custom"
      ? savedPlaces.find((place) => place.type === editingPlaceType)
      : null) ??
    null;
  const landscape = useLandscape();
  const drawerOpen = toolsDrawerOpen;
  const dismissedRouteAlertIdRef = useRef<string | null>(null);
  const navCardRef = useRef<HTMLDivElement>(null);
  const [overlayPadding, setOverlayPadding] = useState({
    top: 90,
    left: 12,
    right: 12,
    bottom: 96,
  });
  const googleAccount = useGoogleAccount();
  const youtubeLibrary = useYoutubeLibrary(
    googleAccount.youtubeAccessToken,
    Boolean(googleAccount.account),
  );
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [rerouting, setRerouting] = useState(false);
  const [reroutePending, setReroutePending] = useState(false);
  const [navigationProgress, setNavigationProgress] =
    useState<NavigationProgress | null>(null);
  const navigationTrackerRef = useRef<NavigationTrackerState | null>(null);
  const reroutingRef = useRef(false);
  const lastRerouteAtRef = useRef(0);
  const lastRerouteSuccessAtRef = useRef(0);
  const lastOffRouteAtRef = useRef(0);
  const rerouteAbortRef = useRef<AbortController | null>(null);
  const rerouteGenerationRef = useRef(0);
  const destinationRef = useRef<RouteDestination | null>(null);
  const vehicleRef = useRef(vehicle);
  const vehicleLiveRef = useRef<VehiclePose>(vehicle);
  const displayVehicleLiveRef = useRef<DisplayPose | null>(null);
  const lastHudVehicleAtRef = useRef(0);
  const lastHudHeadingAvailRef = useRef<boolean | undefined>(undefined);
  const lastHudSourceRef = useRef(vehicle.source);
  const sawGpsFixRef = useRef(false);
  const panIntentRef = useRef(false);
  const lastViewportCenterRef = useRef<{ lng: number; lat: number } | null>(
    null,
  );
  const viewportRef = useRef(viewport);

  const routeProgressModel = useMemo(
    () => createRouteProgressModel(route, routeSteps),
    [route, routeSteps],
  );
  const navigationContextRef = useRef({
    navigating,
    routeProgressModel,
    routeSteps,
  });

  useEffect(() => {
    if (mapDisplayMode !== "auto") return;
    const timer = window.setTimeout(() => {
      setStyleRevision((value) => value + 1);
    }, msUntilAutoSwitch());
    return () => window.clearTimeout(timer);
  }, [mapDisplayMode, styleRevision]);

  useEffect(() => {
    navigationContextRef.current = {
      navigating,
      routeProgressModel,
      routeSteps,
    };
    destinationRef.current = destination;
    vehicleRef.current = vehicle;
    viewportRef.current = viewport;
  }, [destination, navigating, routeProgressModel, routeSteps, vehicle, viewport]);

  const fallbackStep = useMemo(
    () => nextIntersectionStep(routeSteps),
    [routeSteps],
  );
  const activeNavigationStep = navigationProgress
    ? (routeSteps[navigationProgress.stepIndex] ?? fallbackStep)
    : fallbackStep;
  const distanceToNextMeters = navigationProgress
    ? navigationProgress.distanceToNextMeters
    : activeNavigationStep?.cueMeters && activeNavigationStep.cueMeters > 0
      ? activeNavigationStep.cueMeters
      : (maneuver?.distanceMeters ?? activeNavigationStep?.distanceMeters ?? 0);
  const turnManeuver = isTurnManeuver(activeNavigationStep);
  const followingStep = navigationProgress
    ? (routeSteps[navigationProgress.stepIndex + 1] ?? null)
    : (routeSteps[1] ?? null);
  const nextAlertPhase = deriveManeuverAlertPhase(
    navigating,
    turnManeuver,
    distanceToNextMeters,
    isTurnManeuver(followingStep) ? followingStep?.distanceMeters : undefined,
  );
  const approachingIntersection = maneuverAlertActive(nextAlertPhase);

  useNavigationVoice({
    enabled: voiceEnabled,
    navigating,
    step: activeNavigationStep,
    distanceMeters: distanceToNextMeters,
    offRoute: navigationProgress?.offRoute ?? false,
    destinationLabel: destination?.label ?? "",
    routeGeneration: routeEpoch,
  });

  const queryOrigin = useMemo(
    () =>
      resolveMapQueryOrigin({
        gpsReady: gpsStatus === "active" && vehicle.source === "gps",
        vehicleLng: vehicle.lng,
        vehicleLat: vehicle.lat,
        viewportLng: viewport?.center.lng ?? null,
        viewportLat: viewport?.center.lat ?? null,
        userAdjustedMap,
      }),
    [
      gpsStatus,
      userAdjustedMap,
      vehicle.lat,
      vehicle.lng,
      vehicle.source,
      viewport?.center.lat,
      viewport?.center.lng,
    ],
  );
  const queryLng = queryOrigin?.lng ?? null;
  const queryLat = queryOrigin?.lat ?? null;
  const searchOrigin = useMemo(
    () =>
      queryLng == null || queryLat == null
        ? null
        : { lng: queryLng, lat: queryLat },
    [queryLat, queryLng],
  );
  const liveHeading =
    gpsStatus === "active" && vehicle.source === "gps" ? vehicle.heading : 0;

  const {
    origin,
    visible,
    error: cctvError,
    cameraById,
    reload,
  } = useCctvView({
    queryOrigin: searchOrigin,
    headingDegrees: liveHeading,
    viewport,
    route,
    refreshNonce,
  });

  const {
    points: speedEnforcement,
    error: speedEnforcementError,
    reload: reloadSpeedEnforcement,
  } = useSpeedEnforcementView({
    searchOrigin,
    viewport,
    refreshNonce,
  });
  const cameraSpeedLimit = approachingSpeedCameraLimit(vehicle, speedEnforcement);

  const {
    alerts: disasters,
    origin: disasterOrigin,
    error: disasterError,
    reload: reloadDisasters,
  } = useDisasterView(refreshNonce);

  const parkingCenter = navigating
    ? destination?.location ?? (vehicle.source === "gps" ? vehicle : viewport?.center ?? vehicle)
    : vehicle.source === "gps"
      ? vehicle
      : viewport?.center ?? vehicle;
  const parkingRadiusMeters = navigating
    ? PARKING_DESTINATION_RADIUS_M
    : PARKING_CURRENT_LOCATION_RADIUS_M;
  const {
    lots: parkingLots,
    origin: parkingOrigin,
    error: parkingError,
    fetchedAt: parkingFetchedAt,
    loading: parkingLoading,
  } = useParkingView({
    center: parkingCenter,
    enabled: Boolean(parkingCenter),
    radiusMeters: parkingRadiusMeters,
    refreshMs: parkingOpen ? PARKING_PANEL_REFRESH_MS : 0,
  });
  const regionPoint = useMemo(
    () =>
      vehicle.source === "gps"
        ? { lng: vehicle.lng, lat: vehicle.lat }
        : searchOrigin,
    [searchOrigin, vehicle.lat, vehicle.lng, vehicle.source],
  );
  const locatedRegion = useLocatedRegion(regionPoint);
  const mapPois = useMapPois({
    viewport,
    origin: searchOrigin,
    enabled: true,
  });
  const visibleMapPois = useMemo(
    () =>
      mapPois.filter((poi) =>
        isPoiLayerVisible(poiLayerVisibility, poi.category),
      ),
    [mapPois, poiLayerVisibility],
  );

  useEffect(() => {
    let cancelled = false;

    const controller = new AbortController();
    async function load() {
      try {
        const [accidentCatalog, constructionCatalog] = await Promise.all([
          fetchAccidentReports(controller.signal),
          fetchConstructionEvents(controller.signal),
        ]);
        if (cancelled) return;
        setAccidents(accidentCatalog.items);
        setAccidentOrigin(accidentCatalog.origin);
        setConstructions(constructionCatalog.items);
        setConstructionOrigin(constructionCatalog.origin);
        setRoute([]);
        setManeuver(null);
        setBaseIntel([]);
      } catch {
        if (!cancelled) {
          setAccidents([]);
          setConstructions([]);
          setAccidentOrigin("unavailable");
          setConstructionOrigin("unavailable");
        }
      }
    }

    void load();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, []);

  useEffect(() => {
    void queryGeolocationPermission().then(setGpsPermission);
    const flushHudVehicle = (pose: VehiclePose, display: DisplayPose | null) => {
      const now = performance.now();
      const headingChanged = lastHudHeadingAvailRef.current !== pose.headingAvailable;
      const sourceChanged = lastHudSourceRef.current !== pose.source;
      if (
        !headingChanged &&
        !sourceChanged &&
        now - lastHudVehicleAtRef.current < 280
      ) {
        return;
      }
      lastHudVehicleAtRef.current = now;
      lastHudHeadingAvailRef.current = pose.headingAvailable;
      lastHudSourceRef.current = pose.source;
      setVehicle(pose);
      setDisplayVehicle(display);
    };
    const stop = watchVehiclePosition({
      onFix: (pose) => {
        vehicleLiveRef.current = pose;
        vehicleRef.current = pose;
        if (!sawGpsFixRef.current) {
          sawGpsFixRef.current = true;
          panIntentRef.current = false;
          setFollowVehicle(true);
          setUserAdjustedMap(false);
          lastHudVehicleAtRef.current = 0;
        }
        const context = navigationContextRef.current;
        if (!context.navigating || !context.routeProgressModel) {
          displayVehicleLiveRef.current = null;
          flushHudVehicle(pose, null);
          return;
        }
        const next = updateNavigationProgress({
          model: context.routeProgressModel,
          steps: context.routeSteps,
          vehicle: pose,
          previous: navigationTrackerRef.current,
        });
        navigationTrackerRef.current = next;
        setNavigationProgress(next);
        const snapped = snapVehicleToRoute({
          raw: pose,
          model: context.routeProgressModel,
          previousRouteMeters: next?.routeMeters,
        });
        displayVehicleLiveRef.current = snapped;
        flushHudVehicle(pose, snapped);
      },
      onStatus: setGpsStatus,
      onError: setGpsError,
      onPermission: setGpsPermission,
    });
    return stop;
  }, []);

  const visibleAccidents = useMemo(
    () => mapVisibleAccidents(accidents, viewport, searchOrigin),
    [accidents, searchOrigin, viewport],
  );

  const visibleDisasters = useMemo(
    () =>
      pinSelected(
        mapVisibleDisasters(disasters, viewport, searchOrigin),
        selectedEvent?.kind === "disaster" ? selectedEvent.id : null,
        disasters,
      ),
    [disasters, searchOrigin, selectedEvent, viewport],
  );

  const visibleConstructions = useMemo(
    () => mapVisibleConstruction(constructions, viewport, searchOrigin),
    [constructions, searchOrigin, viewport],
  );

  const mapCameras = useMemo(
    () =>
      pinSelected(
        visible,
        selectedCctv?.id ?? null,
        selectedCctv ? [selectedCctv] : [],
      ),
    [selectedCctv, visible],
  );

  const mapTraffic: [] = [];
  const mapLayerVisibility = {
    ...layerVisibility,
    congestion: false,
  };

  const intel = useMemo(() => {
    const cameras = roadIntelFromCameras(visible);
    const extras = baseIntel.filter(
      (item) =>
        item.kind !== "cctv" &&
        item.kind !== "congestion" &&
        item.kind !== "disaster" &&
        item.kind !== "accident" &&
        item.kind !== "construction",
    );
    const origin = searchOrigin;
    return [
      ...cameras,
      ...deriveConstructionIntel(visibleConstructions, origin),
      ...deriveAccidentIntel(visibleAccidents, origin),
      ...deriveDisasterIntel(visibleDisasters, origin),
      ...extras,
    ];
  }, [
    baseIntel,
    searchOrigin,
    visible,
    visibleAccidents,
    visibleConstructions,
    visibleDisasters,
  ]);

  const searchBias = searchOrigin;

  const selectCamera = useCallback(
    (id: string) => {
      const camera = cameraById(id);
      if (!camera) return;
      const center = searchOrigin ?? viewport?.center ?? null;
      setSelectedEvent({ kind: "cctv", id });
      setEventListKind(null);
      setSelectedCctv({
        ...camera,
        distanceKm:
          camera.distanceKm ??
          (center ? distanceKm(center, camera.location) : undefined),
      });
    },
    [cameraById, searchOrigin, viewport?.center],
  );

  const selectedDisaster = useMemo(() => {
    if (selectedEvent?.kind !== "disaster") return null;
    return disasters.find((alert) => alert.id === selectedEvent.id) ?? null;
  }, [disasters, selectedEvent]);
  const selectedAccident = useMemo(() => {
    if (selectedEvent?.kind !== "accident") return null;
    return accidents.find((item) => item.id === selectedEvent.id) ?? null;
  }, [accidents, selectedEvent]);
  const selectedConstruction = useMemo(() => {
    if (selectedEvent?.kind !== "construction") return null;
    return constructions.find((item) => item.id === selectedEvent.id) ?? null;
  }, [constructions, selectedEvent]);
  const selectedCongestion = null;

  const clearSelectedEvent = useCallback(() => {
    setSelectedEvent(null);
    setSelectedCctv(null);
    setEventListKind(null);
  }, []);

  const focusEvent = useCallback((location: { lng: number; lat: number }) => {
    setFollowVehicle(false);
    setFocusTarget({
      lng: location.lng,
      lat: location.lat,
      key: Date.now(),
    });
  }, []);

  const readDevicePosition = useCallback(async () => {
    const pose = await requestCurrentPosition();
    sawGpsFixRef.current = true;
    panIntentRef.current = false;
    vehicleLiveRef.current = pose;
    vehicleRef.current = pose;
    setVehicle(pose);
    setGpsStatus("active");
    setGpsError(null);
    setGpsPermission("granted");
    setUserAdjustedMap(false);
    return pose;
  }, []);

  const applyRoute = useCallback(async (hit: GeocodeHit, mode = travelMode) => {
    const reliable =
      Number.isFinite(hit.location.lng) &&
      Number.isFinite(hit.location.lat) &&
      Math.abs(hit.location.lng) > 0.2 &&
      Math.abs(hit.location.lat) > 0.2;
    if (!reliable) {
      if (!hit.address && !hit.name) {
        setRouteError("此地點沒有可靠座標，無法開始導航。");
        return;
      }
      try {
        const rows = await searchAddresses(hit.address || hit.name);
        const located =
          rows.find((row) => row.exactHouseNumber) ??
          rows.find((row) => Number.isFinite(row.location.lng)) ??
          null;
        if (!located) {
          setRouteError("此地點沒有可靠座標，無法開始導航。");
          return;
        }
        hit = { ...hit, location: located.location, address: located.address || hit.address };
      } catch {
        setRouteError("此地點沒有可靠座標，無法開始導航。");
        return;
      }
    }
    rememberAddress(hit);
    lastRouteHitRef.current = hit;
    setSelectedMapPlace(null);
    parkingArrivalDismissedRef.current = false;
    setParkingArrivalOpen(false);
    setRouting(true);
    setRouteError(null);
    setSelectedCctv(null);
    setSelectedEvent(null);
    setEventListKind(null);
    try {
      let origin = vehicleRef.current.source === "gps" ? vehicleRef.current : null;
      try {
        origin = await readDevicePosition();
      } catch (error) {
        const code = geoErrorCode(error);
        setGpsError(code);
        if (code === "permission_denied") {
          setGpsStatus("denied");
          setGpsPermission("denied");
        } else if (origin) {
          setGpsStatus("active");
        } else {
          setGpsStatus("unavailable");
        }
        if (!origin) {
          setRouteError(
            code === "permission_denied"
              ? geoErrorMessage(code)
              : "尚未取得真實定位，無法規劃路線。請先允許位置存取。",
          );
          return;
        }
      }
      const plan = await planDrivingRoute(
        { lng: origin.lng, lat: origin.lat },
        hit,
        undefined,
        mode,
      );
      setRoute(plan.coordinates);
      setDestination(plan.destination);
      setManeuver(plan.maneuver);
      setRouteSteps(plan.steps ?? []);
      setRouteEpoch((value) => value + 1);
      setRouteDurationSeconds(plan.durationSeconds);
      setRouteDistanceMeters(plan.distanceMeters);
      setTravelMode(plan.travelMode);
      setMotorcycleUnsupported(false);
      setFollowVehicle(false);
      setNavigating(false);
      navigationTrackerRef.current = null;
      setNavigationProgress(null);
      setFitRouteKey((value) => value + 1);
    } catch (error) {
      const message = error instanceof Error ? error.message : "路線規劃失敗";
      setRouteError(message);
      if (mode === "motorcycle" && message.includes("NOT CONFIGURED")) {
        setMotorcycleUnsupported(true);
      }
    } finally {
      setRouting(false);
    }
  }, [readDevicePosition, travelMode]);

  const handleLongPress = useCallback(
    async (location: { lng: number; lat: number }) => {
      const saved = findSavedCustomPlace(location);
      const place = customPlaceFromLngLat(location);
      if (saved) {
        place.id = saved.id;
        place.name = saved.displayName;
        place.address = saved.originalAddress || place.address;
      }
      setSelectedCctv(null);
      setSelectedEvent(null);
      setSelectedParking(null);
      setSelectedMapPlace(place);
      const hit = await reversePlace(location);
      setSelectedMapPlace((current) => {
        if (current?.id !== place.id) return current;
        const named = findSavedCustomPlace(location);
        return {
          ...current,
          name:
            named?.displayName ||
            (current.name && current.name !== "自訂位置"
              ? current.name
              : hit.name || "自訂位置"),
          address: hit.address || current.address,
        };
      });
    },
    [],
  );

  const shrinkFunctionPanels = useCallback(() => {
    setToolsDrawerOpen(false);
    setParkingOpen(false);
    setSelectedParking(null);
    setFavoritesOpen(false);
    setEventListKind(null);
    setSelectedEvent(null);
    setSelectedCctv(null);
    setMusicMode("off");
    setStyleMenuOpen(false);
    setSelectedMapPlace(null);
    if (parkingArrivalOpen) setParkingArrivalMinimized(true);
  }, [parkingArrivalOpen]);

  const handleEmptyMapClick = useCallback(() => {
    shrinkFunctionPanels();
  }, [shrinkFunctionPanels]);

  const handlePoiSelect = useCallback(
    (poiId: string) => {
      const feature = mapPois.find((item) => item.id === poiId);
      if (!feature) return;
      setSelectedCctv(null);
      setSelectedEvent(null);
      setSelectedParking(null);
      setSelectedMapPlace(poiFeatureToPlace(feature, searchOrigin));
    },
    [mapPois, searchOrigin],
  );

  const handleToggleParking = useCallback(() => {
    setParkingOpen((open) => {
      if (open) {
        setSelectedParking(null);
        return false;
      }
      return true;
    });
    setFavoritesOpen(false);
    setEventListKind(null);
    setSelectedEvent(null);
    setSelectedCctv(null);
    setMusicMode("off");
    setSelectedMapPlace(null);
    setParkingSort("distance");
  }, []);

  const currentPlace = destination ? destinationToHit(destination) : null;
  const isCurrentFavorite = currentPlace ? isFavorite(currentPlace) : false;

  const handleHeartClick = useCallback(() => {
    setFavoritesOpen((open) => !open);
    setParkingOpen(false);
    setSelectedParking(null);
    setSelectedCctv(null);
    setSelectedEvent(null);
    setEventListKind(null);
    setMusicMode("off");
    setSelectedMapPlace(null);
  }, []);

  const clearRoute = useCallback(() => {
    setDestination(null);
    setRouteError(null);
    setRoute([]);
    setManeuver(null);
    setRouteSteps([]);
    setFollowVehicle(true);
    setUserAdjustedMap(false);
    panIntentRef.current = false;
    setNavigating(false);
    navigationTrackerRef.current = null;
    setNavigationProgress(null);
    displayVehicleLiveRef.current = null;
    setDisplayVehicle(null);
    setParkingOpen(false);
    setSelectedParking(null);
  }, []);

  const locate = useCallback(async () => {
    setGpsStatus("locating");
    try {
      const pose = await readDevicePosition();
      if (!followVehicle) {
        setFollowOrientation("heading-up");
        setFollowVehicle(true);
      } else if (pose.source === "gps") {
        setFollowOrientation((current) =>
          current === "heading-up" ? "north-up" : "heading-up",
        );
        setFollowVehicle(true);
      }
      setUserAdjustedMap(false);
      panIntentRef.current = false;
      setRefreshNonce((value) => value + 1);
    } catch (error) {
      const code = geoErrorCode(error);
      setGpsError(code);
      if (code === "permission_denied") {
        setGpsStatus("denied");
        setGpsPermission("denied");
        return;
      }
      if (vehicleRef.current.source === "gps") {
        setGpsStatus("active");
        return;
      }
      setGpsStatus("unavailable");
    }
  }, [followVehicle, readDevicePosition]);

  const startNavigation = useCallback(async () => {
    let pose = vehicleRef.current;
    if (pose.source !== "gps") {
      try {
        pose = await readDevicePosition();
      } catch (error) {
        const code = geoErrorCode(error);
        setGpsError(code);
        setGpsStatus(code === "permission_denied" ? "denied" : "unavailable");
        if (code === "permission_denied") setGpsPermission("denied");
        setRouteError(geoErrorMessage(code));
        return;
      }
    }
    const next = routeProgressModel
      ? updateNavigationProgress({
          model: routeProgressModel,
          steps: routeSteps,
          vehicle: pose,
          previous: null,
        })
      : null;
    navigationTrackerRef.current = next;
    setNavigationProgress(next);
    const snapped = routeProgressModel
      ? snapVehicleToRoute({
          raw: pose,
          model: routeProgressModel,
          previousRouteMeters: next?.routeMeters,
        })
      : null;
    displayVehicleLiveRef.current = snapped;
    setDisplayVehicle(snapped);
    setNavigating(true);
    arrivalFiredRef.current = false;
    parkingArrivalDismissedRef.current = false;
    setParkingArrivalOpen(false);
    setParkingArrivalMinimized(false);
    setArrivalNotice(null);
    setToolsDrawerOpen(false);
    setCameraMode("3d");
    setFollowVehicle(true);
    setUserAdjustedMap(false);
    panIntentRef.current = false;
    setSelectedCctv(null);
    setSelectedEvent(null);
    setEventListKind(null);
  }, [readDevicePosition, routeProgressModel, routeSteps]);

  const exitNavigation = useCallback(() => {
    rerouteAbortRef.current?.abort();
    restartLockRef.current = false;
    reroutingRef.current = false;
    setRerouting(false);
    setReroutePending(false);
    setNavigating(false);
    dismissedRouteAlertIdRef.current = null;
    setToolsDrawerOpen(false);
    navigationTrackerRef.current = null;
    setNavigationProgress(null);
    displayVehicleLiveRef.current = null;
    setDisplayVehicle(null);
    setFollowVehicle(false);
    setFitRouteKey((value) => value + 1);
    setParkingArrivalOpen(false);
    setParkingArrivalMinimized(false);
  }, []);

  const completeArrival = useCallback(() => {
    if (arrivalFiredRef.current) return;
    arrivalFiredRef.current = true;
    parkingArrivalDismissedRef.current = true;
    setArrivalNotice("已抵達目的地");
    if (typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance("已抵達目的地");
      utterance.lang = "zh-TW";
      utterance.rate = 1.05;
      window.speechSynthesis.speak(utterance);
    }
    exitNavigation();
    setRoute([]);
    setManeuver(null);
    setRouteSteps([]);
    setRouteDurationSeconds(null);
    setRouteDistanceMeters(null);
    setDestination(null);
    setRouteError(null);
    window.setTimeout(() => setArrivalNotice(null), 3200);
  }, [exitNavigation]);

  const refreshIntel = useCallback(() => {
    setRefreshNonce((value) => value + 1);
    reload();
    reloadSpeedEnforcement();
    reloadDisasters();
  }, [reload, reloadDisasters, reloadSpeedEnforcement]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      refreshIntel();
    }, 5 * 60 * 1000);
    return () => window.clearInterval(timer);
  }, [refreshIntel]);

  const rerouteFromHere = useCallback(async () => {
    const dest = destinationRef.current;
    const raw = vehicleLiveRef.current ?? vehicleRef.current;
    const snapped = displayVehicleLiveRef.current;
    const here = {
      lng: raw.lng,
      lat: raw.lat,
    };
    if (!dest) return;
    if (arrivalFiredRef.current) return;
    const tracker = navigationTrackerRef.current;
    if (tracker?.arrived) {
      completeArrival();
      return;
    }
    const now = Date.now();
    if (restartLockRef.current) return;
    if (now - lastRerouteSuccessAtRef.current < SOFT_RESTART_COOLDOWN_MS) return;
    if (now - lastRerouteAtRef.current < SOFT_RESTART_ATTEMPT_GAP_MS) return;
    rerouteAbortRef.current?.abort();
    const controller = new AbortController();
    rerouteAbortRef.current = controller;
    const generation = rerouteGenerationRef.current + 1;
    rerouteGenerationRef.current = generation;
    restartLockRef.current = true;
    reroutingRef.current = true;
    lastRerouteAtRef.current = now;
    setRerouting(true);
    setReroutePending(false);
    setNavigating(false);
    navigationTrackerRef.current = null;
    setNavigationProgress(null);
    setManeuver(null);
    setRouteDurationSeconds(null);
    const detectMs = lastOffRouteAtRef.current
      ? now - lastOffRouteAtRef.current
      : null;
    const requestStarted = performance.now();
    const staleTimer = window.setTimeout(() => {
      if (
        rerouteGenerationRef.current === generation &&
        reroutingRef.current
      ) {
        setReroutePending(true);
      }
    }, 2500);
    const origin = {
      lng: snapped?.lng ?? here.lng,
      lat: snapped?.lat ?? here.lat,
    };
    const requestOnce = () =>
      planDrivingRoute(
        origin,
        {
          id: "reroute",
          name: dest.label,
          address: dest.address,
          location: dest.location,
        },
        controller.signal,
        travelMode,
        5_500,
      );
    try {
      let plan;
      try {
        plan = await requestOnce();
      } catch (error) {
        if (controller.signal.aborted) throw error;
        plan = await requestOnce();
      }
      const responseMs = performance.now() - requestStarted;
      if (generation !== rerouteGenerationRef.current) return;
      const parseStarted = performance.now();
      const steps = plan.steps ?? [];
      const model = createRouteProgressModel(plan.coordinates, steps);
      setRoute(plan.coordinates);
      setDestination(plan.destination);
      setManeuver(plan.maneuver);
      setRouteSteps(steps);
      setRouteEpoch((value) => value + 1);
      setRouteDurationSeconds(plan.durationSeconds);
      setRouteDistanceMeters(plan.distanceMeters);
      const pose = vehicleLiveRef.current ?? vehicleRef.current;
      const next = model
        ? updateNavigationProgress({
            model,
            steps,
            vehicle: pose,
            previous: null,
          })
        : null;
      navigationTrackerRef.current = next;
      setNavigationProgress(next);
      const snappedPose = model
        ? snapVehicleToRoute({
            raw: pose,
            model,
            previousRouteMeters: next?.routeMeters,
          })
        : null;
      displayVehicleLiveRef.current = snappedPose;
      setDisplayVehicle(snappedPose);
      setNavigating(true);
      setFollowVehicle(true);
      setUserAdjustedMap(false);
      panIntentRef.current = false;
      lastRerouteSuccessAtRef.current = Date.now();
      const parseMs = performance.now() - parseStarted;
      const totalMs = performance.now() - requestStarted;
      logRerouteTimings("ready", {
        detectMs,
        requestMs: responseMs,
        responseMs,
        parseMs,
        renderMs: parseMs,
        totalMs,
        at: new Date().toISOString(),
      });
    } catch (error) {
      if (controller.signal.aborted) return;
      if (generation !== rerouteGenerationRef.current) return;
      setRouteError(
        error instanceof Error && /abort|timeout|逾時/i.test(error.message)
          ? "重新規劃逾時，請再試一次"
          : error instanceof Error
            ? error.message
            : "重新規劃路線失敗",
      );
    } finally {
      window.clearTimeout(staleTimer);
      if (generation === rerouteGenerationRef.current) {
        restartLockRef.current = false;
        reroutingRef.current = false;
        setRerouting(false);
        setReroutePending(false);
      }
    }
  }, [completeArrival, travelMode]);

  useEffect(() => {
    if (navigating && navigationProgress?.arrived) {
      completeArrival();
    }
  }, [completeArrival, navigating, navigationProgress?.arrived]);

  useEffect(() => {
    if (!navigating || !navigationProgress?.offRoute) return;
    if (navigationProgress.arrived || arrivalFiredRef.current) return;
    if (!lastOffRouteAtRef.current) lastOffRouteAtRef.current = Date.now();
    void rerouteFromHere();
  }, [
    navigating,
    navigationProgress?.arrived,
    navigationProgress?.offRoute,
    rerouteFromHere,
  ]);

  useEffect(() => {
    if (!navigationProgress?.offRoute) lastOffRouteAtRef.current = 0;
  }, [navigationProgress?.offRoute]);

  const remainingToDestination =
    navigationProgress && routeDistanceMeters != null
      ? Math.max(0, routeDistanceMeters - navigationProgress.routeMeters)
      : null;

  useEffect(() => {
    if (!navigating || !parkingArrivalEnabled) return;
    if (parkingArrivalDismissedRef.current) return;
    if (remainingToDestination == null) return;
    if (
      remainingToDestination > PARKING_REMINDER_METERS + 20 ||
      remainingToDestination < PARKING_REMINDER_MIN_METERS
    ) {
      return;
    }
    if (remainingToDestination > PARKING_REMINDER_METERS) return;
    parkingArrivalDismissedRef.current = true;
    const text = "即將抵達目的地，需要幫您尋找附近停車場嗎？";
    const timer = window.setTimeout(() => {
      setParkingArrivalOpen(true);
      setParkingArrivalMinimized(false);
      if (window.speechSynthesis && !window.speechSynthesis.speaking) {
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = "zh-TW";
        utterance.rate = 1.05;
        window.speechSynthesis.speak(utterance);
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, [navigating, parkingArrivalEnabled, remainingToDestination]);

  useEffect(() => {
    if (!parkingArrivalOpen || parkingArrivalMinimized) return;
    const timer = window.setTimeout(() => {
      setParkingArrivalMinimized(true);
    }, PARKING_REMINDER_SHRINK_MS);
    return () => window.clearTimeout(timer);
  }, [parkingArrivalMinimized, parkingArrivalOpen]);

  const routeAlert = useMemo(
    () =>
      navigating
        ? pickActiveRouteAlert({
            model: routeProgressModel,
            routeMeters: navigationProgress?.routeMeters ?? 0,
            accidents,
            constructions,
            disasters,
            traffic: [],
          })
        : null,
    [
      accidents,
      constructions,
      disasters,
      navigating,
      navigationProgress?.routeMeters,
      routeProgressModel,
    ],
  );

  const hasRouteAlert = Boolean(routeAlert);
  const blockingRouteIncident = Boolean(
    routeAlert &&
      (routeAlert.kind === "accident" || routeAlert.kind === "construction"),
  );

  useEffect(() => {
    if (!navigating) {
      dismissedRouteAlertIdRef.current = null;
      return;
    }
    if (!routeAlert || !blockingRouteIncident) return;
    if (dismissedRouteAlertIdRef.current === routeAlert.id) return;
    setToolsDrawerOpen(true);
  }, [blockingRouteIncident, navigating, routeAlert]);

  useEffect(() => {
    if (!drawerOpen) return;
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (!target) return;
      const drawer = document.getElementById("navpilot-function-drawer");
      const rail = document.querySelector(".hud-anchor-rail");
      if (drawer?.contains(target) || rail?.contains(target)) return;
      setToolsDrawerOpen(false);
      if (routeAlert) dismissedRouteAlertIdRef.current = routeAlert.id;
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [drawerOpen, routeAlert]);

  useEffect(() => {
    if (!navigating) return;
    const el = navCardRef.current;
    if (!el) return;
    const update = () => {
      const rect = el.getBoundingClientRect();
      setOverlayPadding({
        top: Math.max(90, Math.round(rect.bottom + 12)),
        left: 12,
        right: 12,
        bottom: hasRouteAlert ? 148 : 96,
      });
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    window.addEventListener("resize", update);
    window.addEventListener("orientationchange", update);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", update);
      window.removeEventListener("orientationchange", update);
    };
  }, [hasRouteAlert, landscape, navigating]);

  const intelByKind = useMemo(() => {
    const groups: Record<RoadIntelKind, RoadIntelItem[]> = {
      congestion: [],
      cctv: [],
      construction: [],
      accident: [],
      disaster: [],
    };
    for (const item of intel) groups[item.kind].push(item);
    for (const kind of Object.keys(groups) as RoadIntelKind[]) {
      groups[kind].sort((a, b) => a.distanceMeters - b.distanceMeters);
    }
    return groups;
  }, [intel]);

  const openIntelItem = useCallback(
    (item: RoadIntelItem) => {
      const id = item.eventId ?? item.cameraId ?? item.id;
      setSelectedEvent({ kind: item.kind, id });
      setEventListKind(null);
      if (item.kind === "cctv") {
        selectCamera(id);
      } else {
        setSelectedCctv(null);
      }
      if (item.location) focusEvent(item.location);
    },
    [focusEvent, selectCamera],
  );

  const handleKindClick = useCallback(
    (kind: RoadIntelKind) => {
      const visible = layerVisibility[kind];
      if (visible && (eventListKind === kind || selectedEvent?.kind === kind)) {
        setLayerVisibility((current) => ({ ...current, [kind]: false }));
        if (selectedEvent?.kind === kind) {
          setSelectedEvent(null);
          setSelectedCctv(null);
        }
        if (eventListKind === kind) setEventListKind(null);
        return;
      }
      setParkingOpen(false);
      setSelectedParking(null);
      setFavoritesOpen(false);
      setMusicMode("off");
      setSelectedMapPlace(null);
      if (!visible) {
        setLayerVisibility((current) => ({ ...current, [kind]: true }));
      }
      const items = intelByKind[kind];
      if (items.length === 1) {
        openIntelItem(items[0]);
        return;
      }
      setEventListKind(kind);
      setSelectedEvent(null);
      setSelectedCctv(null);
    },
    [eventListKind, intelByKind, layerVisibility, openIntelItem, selectedEvent],
  );

  const kindOrigin = (kind: RoadIntelKind) => {
    if (kind === "cctv") return origin;
    if (kind === "congestion") return "unavailable";
    if (kind === "disaster") return disasterOrigin;
    if (kind === "accident") return accidentOrigin;
    return constructionOrigin;
  };

  const selectedEventCard =
    selectedAccident
      ? accidentToCard(selectedAccident, accidentOrigin)
      : selectedConstruction
        ? constructionToCard(selectedConstruction, constructionOrigin)
        : selectedDisaster
          ? disasterToCard(selectedDisaster, disasterOrigin)
          : selectedCongestion
            ? congestionToCard(selectedCongestion)
            : null;

  const selectedEventLocation =
    selectedAccident?.location ??
    selectedConstruction?.location ??
    selectedDisaster?.location ??
    (selectedCongestion ? segmentAnchor(selectedCongestion) : null);

  return (
    <div className="relative h-dvh w-full overflow-hidden overscroll-none bg-[#0b0d11] text-zinc-100">
      <DrivingMap
        vehicle={vehicle}
        displayVehicle={displayVehicle}
        vehicleLiveRef={vehicleLiveRef}
        displayVehicleLiveRef={displayVehicleLiveRef}
        cameraMode={cameraMode}
        followOrientation={followOrientation}
        followVehicle={followVehicle}
        mapDisplayMode={pendingMapDisplayMode ?? mapDisplayMode}
        styleRevision={styleRevision}
        pickMode={pickMode}
        navigating={navigating}
        rerouting={rerouting}
        selectedCctvId={selectedCctv?.id ?? null}
        selectedDisasterId={selectedDisaster?.id ?? null}
        cameras={mapCameras}
        speedEnforcement={speedEnforcement}
        traffic={mapTraffic}
        disasters={visibleDisasters}
        accidents={visibleAccidents}
        constructions={visibleConstructions}
        selectedAccidentId={selectedAccident?.id ?? null}
        selectedConstructionId={selectedConstruction?.id ?? null}
        layerVisibility={mapLayerVisibility}
        focusTarget={focusTarget}
        parkingLots={parkingLots}
        selectedParkingId={selectedParking?.id ?? null}
        parkingVisible={parkingOpen}
        mapPois={visibleMapPois}
        selectedPoiId={selectedMapPlace?.kind === "poi" ? selectedMapPlace.id : null}
        onParkingSelect={(id) => {
          const found = parkingLots.find((lot) => lot.id === id) ?? null;
          setSelectedParking(found);
          setParkingSort("distance");
          setParkingOpen(true);
          setFavoritesOpen(false);
          setEventListKind(null);
          setSelectedEvent(null);
          setSelectedCctv(null);
          setMusicMode("off");
          setSelectedMapPlace(null);
          if (found) {
            focusEvent(found.location);
          }
        }}
        onPoiSelect={handlePoiSelect}
        onEmptyMapClick={handleEmptyMapClick}
        route={route}
        routeMeters={navigationProgress?.routeMeters ?? 0}
        distanceToNextMeters={distanceToNextMeters}
        approachingIntersection={approachingIntersection}
        junctionCue={activeNavigationStep?.location ?? null}
        isTurnManeuver={turnManeuver}
        maneuverCueMeters={
          routeProgressModel && navigationProgress
            ? (routeProgressModel.stepMeters[navigationProgress.stepIndex] ?? 0)
            : 0
        }
        maneuverStepId={activeNavigationStep?.id ?? null}
        maneuverAlertPhase={nextAlertPhase}
        destination={destination}
        overlayPadding={navigating ? overlayPadding : null}
        fitRouteKey={fitRouteKey}
        onCctvSelect={selectCamera}
        onAccidentSelect={(id) => {
          const found = accidents.find((item) => item.id === id);
          setSelectedCctv(null);
          setEventListKind(null);
          setSelectedEvent({ kind: "accident", id });
          setMusicMode((mode) => (mode === "open" ? "mini" : mode));
          if (found) focusEvent(found.location);
        }}
        onConstructionSelect={(id) => {
          const found = constructions.find((item) => item.id === id);
          setSelectedCctv(null);
          setEventListKind(null);
          setSelectedEvent({ kind: "construction", id });
          setMusicMode((mode) => (mode === "open" ? "mini" : mode));
          if (found) focusEvent(found.location);
        }}
        onDisasterSelect={(id) => {
          const found = disasters.find((alert) => alert.id === id);
          setSelectedCctv(null);
          setEventListKind(null);
          setSelectedEvent({ kind: "disaster", id });
          setMusicMode((mode) => (mode === "open" ? "mini" : mode));
          if (found) focusEvent(found.location);
        }}
        onUserPan={() => {
          setFollowVehicle(false);
          panIntentRef.current = true;
        }}
        onViewportChange={(next) => {
          setViewport(next);
          const previous = lastViewportCenterRef.current;
          lastViewportCenterRef.current = next.center;
          if (!panIntentRef.current || !previous) return;
          if (distanceKm(previous, next.center) >= 0.12) {
            setUserAdjustedMap(true);
          }
        }}
        onLongPress={(location) => void handleLongPress(location)}
        onPickLocation={(location) => {
          setPickLocation(location);
          setPickAddress(null);
          void reversePlace(location).then((hit) => {
            setPickAddress(
              formatTaiwanRoadName(hit.address || hit.name || "") || null,
            );
          });
        }}
        onStyleApplied={(mode) => {
          writeMapDisplayMode(mode);
          setPendingMapDisplayMode((current) => (current === mode ? null : current));
          setStyleHint(null);
        }}
        onStyleFallback={(message) => {
          setStyleHint(message);
          setPendingMapDisplayMode(null);
        }}
      />

      <div className="driving-vignette pointer-events-none absolute inset-0" />

      {styleHint ? (
        <p className="pointer-events-none absolute top-[max(4.5rem,env(safe-area-inset-top))] left-1/2 z-30 -translate-x-1/2 rounded-full bg-black/70 px-3 py-1 text-xs text-amber-100">
          {styleHint}
        </p>
      ) : null}
      {demoEnabled ? (
        <p className="pointer-events-none absolute top-[max(6.6rem,calc(env(safe-area-inset-top)+6.2rem))] left-1/2 z-30 -translate-x-1/2 rounded-full border border-amber-300/40 bg-amber-500/20 px-3 py-1 text-xs text-amber-100">
          示範資料
        </p>
      ) : null}

      {editingPlaceType ? (
        <div className="hud-anchor-interactive absolute top-[max(5.5rem,env(safe-area-inset-top))] left-3 right-3 z-50 sm:left-3 sm:right-auto">
          <PlaceEditor
            type={editingPlaceType}
            existing={editingPlace}
            currentLocation={{ lng: vehicle.lng, lat: vehicle.lat }}
            pickLocation={pickLocation}
            pickAddress={pickAddress}
            onStartPick={() => {
              setPickMode(true);
              setPickLocation(null);
              setPickAddress(null);
            }}
            onConfirmPick={() => {
              if (!pickLocation || !editingPlaceType) return;
              upsertSavedPlace({
                id: editingPlace?.id,
                type: editingPlaceType,
                displayName:
                  editingPlace?.displayName ??
                  (editingPlaceType === "home"
                    ? "住家"
                    : editingPlaceType === "work"
                      ? "公司"
                      : "自訂位置"),
                originalAddress: pickAddress ?? undefined,
                latitude: pickLocation.lat,
                longitude: pickLocation.lng,
              });
              setPickMode(false);
              setPickLocation(null);
              setEditingPlaceType(null);
              setEditingPlaceId(null);
            }}
            onReselect={() => {
              setPickLocation(null);
              setPickAddress(null);
              setPickMode(true);
            }}
            onCancelPick={() => {
              setPickMode(false);
              setPickLocation(null);
              setPickAddress(null);
            }}
            onSave={(input) => {
              if (!editingPlaceType) return;
              upsertSavedPlace({
                id: editingPlace?.id,
                type: editingPlaceType,
                ...input,
              });
              setEditingPlaceType(null);
              setEditingPlaceId(null);
              setPickMode(false);
            }}
            onRename={(displayName) => {
              if (editingPlace) renameSavedPlace(editingPlace.id, displayName);
            }}
            onDelete={() => {
              if (editingPlace) deleteSavedPlace(editingPlace.id);
              setEditingPlaceType(null);
              setEditingPlaceId(null);
            }}
            onClose={() => {
              setEditingPlaceType(null);
              setEditingPlaceId(null);
              setPickMode(false);
              setPickLocation(null);
            }}
          />
        </div>
      ) : null}

      {destination && navigating ? (
        <div className="hud-anchor-maneuver">
          <NextIntersectionHud
            ref={navCardRef}
            step={activeNavigationStep}
            distanceMeters={distanceToNextMeters}
            offRoute={navigationProgress?.offRoute ?? false}
            rerouting={rerouting}
            reroutePending={reroutePending}
            alertPhase={nextAlertPhase}
            isTurn={turnManeuver}
            onCancelNavigation={exitNavigation}
            voiceEnabled={voiceEnabled}
            onToggleVoice={() => setVoiceEnabled((value) => !value)}
          />
        </div>
      ) : (
        <div className="hud-anchor-interactive pointer-events-auto absolute top-[max(0.45rem,env(safe-area-inset-top))] left-[max(0.5rem,env(safe-area-inset-left))] right-[max(0.5rem,env(safe-area-inset-right))] z-50 min-w-0 max-w-full sm:right-[max(5.5rem,calc(env(safe-area-inset-right)+4.75rem))]">
          {destination ? (
            <RouteConfirmBar
              destination={destination}
              maneuver={maneuver}
              travelMode={travelMode}
              durationSeconds={routeDurationSeconds}
              distanceMeters={routeDistanceMeters}
              rerouting={routing || rerouting}
              motorcycleUnsupported={motorcycleUnsupported}
              favorite={isCurrentFavorite}
              onToggleFavorite={() => {
                if (!currentPlace) return;
                if (isCurrentFavorite) removeFavorite(currentPlace);
                else addFavorite(currentPlace);
              }}
              onTravelMode={(mode) => {
                setTravelMode(mode);
                const hit = lastRouteHitRef.current;
                if (hit) void applyRoute(hit, mode);
              }}
              onStartNav={startNavigation}
              onClear={clearRoute}
            />
          ) : (
            <>
              <AddressSearch
                bias={searchBias}
                region={locatedRegion}
                busy={routing}
                error={routeError}
                onSelect={(hit) => {
                  setParkingOpen(false);
                  setFavoritesOpen(false);
                  setEventListKind(null);
                  setSelectedEvent(null);
                  setSelectedCctv(null);
                  setSelectedParking(null);
                  setSelectedMapPlace(geocodeHitToPlace(hit));
                  focusEvent(hit.location);
                }}
              />
              <SavedPlaceBar
                home={homePlace}
                work={workPlace}
                customs={customPlaces}
                onGo={(place) => void applyRoute(savedPlaceToHit(place))}
                onEdit={(type, id) => {
                  setEditingPlaceType(type);
                  setEditingPlaceId(id ?? null);
                  setPickMode(false);
                  setPickLocation(null);
                }}
              />
            </>
          )}
        </div>
      )}

      <div className={styleMenuOpen ? "hud-anchor-rail hud-anchor-interactive" : "hud-anchor-rail"}>
        <MapControls
          cameraMode={cameraMode}
          followOrientation={followOrientation}
          followVehicle={followVehicle}
          gpsStatus={gpsStatus}
          heading={vehicle.heading}
          mapDisplayMode={mapDisplayMode}
          pendingMapDisplayMode={pendingMapDisplayMode}
          styleMenuOpen={styleMenuOpen}
          toolsDrawerOpen={drawerOpen}
          navigating={navigating}
          onLocate={() => void locate()}
          onToggleCamera={() =>
            setCameraMode((mode) => (mode === "3d" ? "2d" : "3d"))
          }
          onToggleToolsDrawer={() =>
            setToolsDrawerOpen((open) => {
              const next = !open;
              if (!next && routeAlert) {
                dismissedRouteAlertIdRef.current = routeAlert.id;
              }
              return next;
            })
          }
          onMapDisplayMode={(mode) => {
            if (mode === mapDisplayMode && pendingMapDisplayMode == null) {
              setStyleMenuOpen(false);
              return;
            }
            setPendingMapDisplayMode(mode);
            setStyleMenuOpen(false);
            setStyleHint(null);
          }}
          onToggleStyleMenu={() => setStyleMenuOpen((open) => !open)}
        />
      </div>

      {!navigating ? (
        <div className="pointer-events-none absolute bottom-28 left-2 z-10 hidden max-w-[11rem] sm:bottom-36 sm:left-3 sm:block">
          <Legend />
        </div>
      ) : null}

      <MapAttribution mapDisplayMode={pendingMapDisplayMode ?? mapDisplayMode} />

      <div className={navigating ? "hud-anchor-gps" : "hud-anchor-gps hud-anchor-gps--browse"}>
        <GpsFixChip
          vehicle={vehicle}
          status={gpsStatus}
          permission={gpsPermission}
          error={gpsError}
          tone={resolveMapBasemap(mapDisplayMode)}
          onRetry={() => void locate()}
        />
      </div>

      {navigating ? (
        <div
          className={
            drawerOpen ? "hud-anchor-trip hud-anchor-trip--drawer" : "hud-anchor-trip"
          }
        >
          <div className="hud-trip-stack">
            <div className="hud-speed-row">
              <div className="hud-speed-column">
                <SpeedLimitBadge kph={cameraSpeedLimit?.speedLimitKph ?? null} />
                <SpeedHud sample={vehicle} />
              </div>
            </div>
            <TripStatusCluster
              remainingMeters={
                navigationProgress
                  ? Math.max(
                      0,
                      (routeDistanceMeters ?? 0) - navigationProgress.routeMeters,
                    )
                  : routeDistanceMeters
              }
              remainingSeconds={
                navigationProgress && routeDistanceMeters
                  ? Math.max(
                      0,
                      (routeDurationSeconds ?? 0) *
                        (1 - navigationProgress.routeMeters / Math.max(routeDistanceMeters, 1)),
                    )
                  : routeDurationSeconds
              }
            />
          </div>
        </div>
      ) : null}

      {parkingOpen ? (
        <div
          className={
            navigating
              ? "pointer-events-none absolute inset-x-0 top-[max(7.35rem,calc(env(safe-area-inset-top)+6.7rem))] z-[60] flex justify-center px-[max(0.75rem,env(safe-area-inset-left))] pr-[max(0.75rem,env(safe-area-inset-right))]"
              : landscape
                ? "pointer-events-none absolute inset-0 z-[60] flex items-start justify-center pt-[18vh] px-[max(0.75rem,env(safe-area-inset-left))] pr-[max(0.75rem,env(safe-area-inset-right))]"
                : drawerOpen
                  ? "pointer-events-none absolute inset-0 z-[60] flex items-end justify-center px-[max(0.75rem,env(safe-area-inset-left))] pr-[max(0.75rem,env(safe-area-inset-right))] pb-[max(14.75rem,calc(env(safe-area-inset-bottom)+13.5rem))]"
                  : "pointer-events-none absolute inset-0 z-[60] flex items-end justify-center px-[max(0.75rem,env(safe-area-inset-left))] pr-[max(0.75rem,env(safe-area-inset-right))] pb-[max(1.25rem,calc(env(safe-area-inset-bottom)+0.75rem))]"
          }
        >
          <div className="pointer-events-auto w-full max-w-xl">
            <ParkingPanel
              lots={parkingLots}
              origin={parkingOrigin}
              fetchedAt={parkingFetchedAt}
              city={locatedRegion.city}
              loading={parkingLoading}
              selected={selectedParking}
              sort={parkingSort}
              onSort={setParkingSort}
              onSelect={(lot) => {
                setSelectedParking(lot);
                focusEvent(lot.location);
              }}
              onNavigate={(lot) => {
                setParkingOpen(false);
                void applyRoute({
                  id: `parking-${lot.id}`,
                  name: lot.name,
                  address: formatTaiwanRoadName(lot.address || lot.name),
                  location: lot.location,
                });
              }}
              onClose={() => {
                setParkingOpen(false);
                setSelectedParking(null);
              }}
              arrivalPromptEnabled={parkingArrivalEnabled}
              onToggleArrivalPrompt={(enabled) => {
                setParkingArrivalPromptEnabled(enabled);
              }}
            />
          </div>
        </div>
      ) : null}

      {arrivalNotice ? (
        <div className="pointer-events-none absolute left-1/2 top-[max(1.1rem,calc(env(safe-area-inset-top)+0.6rem))] z-[70] -translate-x-1/2 rounded-full border border-emerald-300/35 bg-black/55 px-4 py-2 text-sm font-semibold text-emerald-100 shadow-lg backdrop-blur-md">
          {arrivalNotice}
        </div>
      ) : null}

      <footer className="hud-anchor-interactive absolute inset-x-0 bottom-0 z-50 flex max-w-[100vw] flex-col items-center gap-1.5 overflow-visible px-[max(0.5rem,env(safe-area-inset-left))] pr-[max(0.5rem,env(safe-area-inset-right))] pb-[max(0.45rem,env(safe-area-inset-bottom))] sm:p-4 sm:pt-0">
        <div
          className={
            navigating
              ? "pointer-events-none fixed inset-x-0 top-[max(7.35rem,calc(env(safe-area-inset-top)+6.7rem))] z-50 flex max-w-[100vw] flex-col items-center gap-1.5 px-[max(0.5rem,env(safe-area-inset-left))] pr-[max(0.5rem,env(safe-area-inset-right))]"
              : "contents"
          }
        >
        {parkingArrivalOpen ? (
          <ParkingArrivalCard
            minimized={parkingArrivalMinimized}
            onExpand={() => setParkingArrivalMinimized(false)}
            onFind={() => {
              setParkingArrivalOpen(false);
              setParkingArrivalMinimized(false);
              parkingArrivalDismissedRef.current = true;
              setParkingSort("distance");
              setParkingOpen(true);
              setFavoritesOpen(false);
              setEventListKind(null);
              setSelectedEvent(null);
              setSelectedCctv(null);
              setMusicMode("off");
              setSelectedMapPlace(null);
            }}
            onSkip={() => {
              setParkingArrivalOpen(false);
              setParkingArrivalMinimized(false);
              parkingArrivalDismissedRef.current = true;
            }}
          />
        ) : null}
        {selectedMapPlace ? (
          <PlaceInfoCard
            place={selectedMapPlace}
            favorite={isFavorite(mapPlaceToHit(selectedMapPlace))}
            onNavigate={() => {
              const hit = mapPlaceToHit(selectedMapPlace);
              setSelectedMapPlace(null);
              setParkingOpen(false);
              void applyRoute(hit);
            }}
            onToggleFavorite={() => {
              const hit = mapPlaceToHit(selectedMapPlace);
              if (isFavorite(hit)) removeFavorite(hit);
              else addFavorite(hit);
              setSelectedMapPlace({ ...selectedMapPlace });
            }}
            onRename={
              selectedMapPlace.kind === "custom"
                ? (name) => {
                    const saved = upsertSavedPlace({
                      id:
                        findSavedCustomPlace(selectedMapPlace.location)?.id ??
                        selectedMapPlace.id,
                      type: "custom",
                      displayName: name,
                      originalAddress: selectedMapPlace.address,
                      latitude: selectedMapPlace.location.lat,
                      longitude: selectedMapPlace.location.lng,
                    });
                    setSelectedMapPlace({
                      ...selectedMapPlace,
                      id: saved.id,
                      name: saved.displayName,
                    });
                  }
                : undefined
            }
            onClose={() => setSelectedMapPlace(null)}
          />
        ) : null}
        {eventListKind ? (
          <EventListPanel
            kind={eventListKind}
            items={intelByKind[eventListKind]}
            emptyHint={
              kindOrigin(eventListKind) === "unavailable"
                ? "資料暫時無法取得"
                : "目前畫面內沒有此類事件"
            }
            onSelect={openIntelItem}
            onClose={() => setEventListKind(null)}
          />
        ) : null}
        {selectedCctv ? (
          <CctvDetailCard
            key={selectedCctv.id}
            camera={selectedCctv}
            onClose={clearSelectedEvent}
          />
        ) : null}
        {selectedEventCard && !selectedCctv ? (
          <EventDetailCard
            event={selectedEventCard}
            onClose={clearSelectedEvent}
            onNavigate={
              selectedEventLocation
                ? () =>
                    void applyRoute({
                      id: `event-${selectedEvent?.id ?? "point"}`,
                      name: selectedEventCard.title,
                      address: formatTaiwanRoadName(
                        selectedEventCard.roadName || selectedEventCard.title,
                      ),
                      location: selectedEventLocation,
                    })
                : undefined
            }
          />
        ) : null}
        {musicMode !== "off" ? (
          <YouTubeMusicPlayer
            compact={musicMode === "mini"}
            playlists={
              youtubeLibrary.playlists.length > 0
                ? youtubeLibrary.playlists
                : YOUTUBE_PLAYLISTS
            }
            libraryStatus={youtubeLibrary.status}
            libraryMessage={youtubeLibrary.message}
            signedIn={Boolean(googleAccount.account)}
            onClose={() => {
              setMusicMode("off");
            }}
            onExpand={() => setMusicMode("open")}
            onConnectLibrary={() => {
              void googleAccount.connectYoutube();
            }}
          />
        ) : null}
        </div>
        <div
          id="navpilot-function-drawer"
          className={
            drawerOpen
              ? "function-drawer"
              : "function-drawer function-drawer--closed"
          }
        >
        <PoiLayerBar
          visibility={poiLayerVisibility}
          onToggle={(id) =>
            setPoiLayerVisibility((current) => ({
              ...current,
              [id]: !current[id],
            }))
          }
        />
        <RoadInformationCard
          items={intel}
          origin={origin}
          disasterOrigin={disasterOrigin}
          emptyHint="目前畫面內尚無 CCTV、事故或災害情報。"
          onSelectCctv={selectCamera}
          layerVisibility={layerVisibility}
          activeKind={eventListKind ?? selectedEvent?.kind ?? null}
          onKindClick={handleKindClick}
          musicOpen={musicMode !== "off"}
          favorites={userFavorites}
          favoritesOpen={favoritesOpen}
          canFavorite={Boolean(currentPlace)}
          isCurrentFavorite={isCurrentFavorite}
          routeAlert={routeAlert}
          compact
          onHeartClick={handleHeartClick}
          onAddFavorite={() => {
            if (currentPlace) addFavorite(currentPlace);
          }}
          onCloseFavorites={() => setFavoritesOpen(false)}
          onSelectFavorite={(hit) => {
            setFavoritesOpen(false);
            void applyRoute(hit);
          }}
          onRemoveFavorite={removeFavorite}
          onRenameFavorite={renameFavorite}
          account={googleAccount.account}
          accountBusy={googleAccount.busy}
          accountHint={googleAccount.hint}
          accountConfigured={googleAccount.configured}
          accountUnavailable={googleAccount.unavailable}
          onSignIn={googleAccount.signIn}
          onSignOut={googleAccount.signOut}
          parkingOn={parkingOpen}
          parkingLoading={parkingLoading}
          onToggleParking={handleToggleParking}
          onPreviewOpen={() => {
            setFavoritesOpen(false);
            setSelectedCctv(null);
            setSelectedEvent(null);
            setEventListKind(null);
            setMusicMode("off");
          }}
          onToggleMusic={() => {
            setFavoritesOpen(false);
            setParkingOpen(false);
            setSelectedParking(null);
            setSelectedCctv(null);
            setSelectedEvent(null);
            setEventListKind(null);
            setSelectedMapPlace(null);
            setMusicMode((mode) => {
              if (mode === "off") return "open";
              return "off";
            });
          }}
        />
        </div>
      </footer>

      {cctvError || speedEnforcementError || disasterError || parkingError ? (
        <div className="pointer-events-none absolute top-[max(11rem,calc(env(safe-area-inset-top)+10rem))] left-1/2 z-20 -translate-x-1/2 rounded-xl border border-amber-300/25 bg-black/65 px-3 py-2 text-xs text-amber-100">
          {cctvError ?? speedEnforcementError ?? disasterError ?? parkingError}
        </div>
      ) : null}
    </div>
  );
}

function Legend() {
  const items = [
    { color: "bg-[#3ee0ff]", label: "導航路線" },
    { color: "bg-[#c084fc]", label: "CCTV" },
    { color: "bg-[#fbbf24]", label: "測速執法" },
    { color: "bg-[#22c55e]", label: "停車場（充足）" },
    { color: "bg-[#eab308]", label: "施工／車位不多" },
    { color: "bg-[#ef4444]", label: "事故" },
    { color: "bg-[#ff9f1c]", label: "災害" },
  ];

  return (
    <div className="rounded-2xl border border-white/10 bg-black/40 px-3 py-2 text-[11px] text-zinc-300 backdrop-blur-md">
      {items.map((item) => (
        <div key={item.label} className="flex items-center gap-2 py-0.5">
          <span className={`size-2.5 rounded-full ${item.color}`} />
          {item.label}
        </div>
      ))}
    </div>
  );
}
