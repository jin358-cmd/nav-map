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
import { X } from "lucide-react";
import { MapControls } from "@/components/map/map-controls";
import { Button } from "@/components/ui/button";
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
import { ParkingPanel } from "@/components/overlay/parking-panel";
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
import { useParkingView } from "@/hooks/use-parking-view";
import { useTrafficView } from "@/hooks/use-traffic-view";
import { roadIntelFromCameras } from "@/lib/cctv-intel";
import { deriveAccidentIntel, mapVisibleAccidents } from "@/lib/accident-query";
import {
  deriveConstructionIntel,
  mapVisibleConstruction,
} from "@/lib/construction-query";
import { deriveDisasterIntel } from "@/lib/disaster-intel";
import { mapVisibleDisasters } from "@/lib/disaster-query";
import { isDemoDataEnabled } from "@/lib/runtime-demo";
import { segmentAnchor } from "@/lib/traffic-query";
import { rememberAddress } from "@/lib/address-history";
import {
  addFavorite,
  getFavoritesSnapshot,
  getServerFavoritesSnapshot,
  isFavorite,
  removeFavorite,
  subscribeFavorites,
} from "@/lib/favorites";
import { pinSelected } from "@/lib/map-visibility";
import { destinationToHit } from "@/lib/poi-search";
import { CITY_TRAFFIC_FOCUS_KM } from "@/lib/traffic-constants";
import {
  DEMO_VEHICLE,
  JUNCTION_FOCUS_ENTER_METERS,
  JUNCTION_FOCUS_EXIT_METERS,
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
  msUntilAutoSwitch,
  readMapDisplayMode,
  writeMapDisplayMode,
} from "@/lib/map-display-mode";
import {
  deleteSavedPlace,
  getSavedPlacesSnapshot,
  getServerSavedPlacesSnapshot,
  renameSavedPlace,
  savedPlaceToHit,
  subscribeSavedPlaces,
  upsertSavedPlace,
} from "@/lib/saved-places";
import { deriveTrafficIntel } from "@/lib/traffic-intel";
import {
  fetchAccidentReports,
  planDrivingRoute,
  requestCurrentPosition,
  watchVehiclePosition,
} from "@/services";
import { fetchConstructionEvents } from "@/services/construction";
import { reversePlace } from "@/services/routing";
import type {
  AccidentReport,
  CameraMode,
  CctvCamera,
  ConstructionEvent,
  EventDataOrigin,
  GeocodeHit,
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
  congestion: true,
  cctv: true,
  construction: true,
  accident: true,
  disaster: true,
};

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
  const [followVehicle, setFollowVehicle] = useState(true);
  const [mapDisplayMode, setMapDisplayMode] = useState<MapDisplayMode>(() =>
    typeof window === "undefined" ? "dark" : readMapDisplayMode(),
  );
  const [styleMenuOpen, setStyleMenuOpen] = useState(false);
  const [styleRevision, setStyleRevision] = useState(0);
  const [styleHint, setStyleHint] = useState<string | null>(null);
  const [editingPlaceType, setEditingPlaceType] = useState<SavedPlaceType | null>(
    null,
  );
  const [pickMode, setPickMode] = useState(false);
  const [pickLocation, setPickLocation] = useState<{
    lng: number;
    lat: number;
  } | null>(null);
  const [pickAddress, setPickAddress] = useState<string | null>(null);
  const [gpsStatus, setGpsStatus] = useState<GpsStatus>("idle");
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
  const [focusTarget, setFocusTarget] = useState<MapFocusTarget | null>(null);
  const [parkingOpen, setParkingOpen] = useState(false);
  const [parkingSort, setParkingSort] = useState<ParkingSort>("distance");
  const [selectedParking, setSelectedParking] = useState<ParkingLot | null>(null);
  const [route, setRoute] = useState<[number, number][]>([]);
  const [maneuver, setManeuver] = useState<NavigationManeuver | null>(null);
  const [destination, setDestination] = useState<RouteDestination | null>(null);
  const [routeSteps, setRouteSteps] = useState<RouteStep[]>([]);
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
  const [intelCollapse, setIntelCollapse] = useState(0);
  const [musicMode, setMusicMode] = useState<"off" | "open" | "mini">("off");
  const [favoritesOpen, setFavoritesOpen] = useState(false);
  const favorites = useSyncExternalStore(
    subscribeFavorites,
    getFavoritesSnapshot,
    getServerFavoritesSnapshot,
  );
  const savedPlaces = useSyncExternalStore(
    subscribeSavedPlaces,
    getSavedPlacesSnapshot,
    getServerSavedPlacesSnapshot,
  );
  const homePlace = savedPlaces.find((place) => place.type === "home") ?? null;
  const workPlace = savedPlaces.find((place) => place.type === "work") ?? null;
  const trafficFocus5km = true;
  const landscape = useLandscape();
  const navCardRef = useRef<HTMLDivElement>(null);
  const [overlayPadding, setOverlayPadding] = useState({
    top: 90,
    left: 24,
    right: 88,
    bottom: 130,
  });
  const googleAccount = useGoogleAccount();
  const youtubeLibrary = useYoutubeLibrary(
    googleAccount.youtubeAccessToken,
    Boolean(googleAccount.account),
  );
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [rerouting, setRerouting] = useState(false);
  const [reroutePending, setReroutePending] = useState(false);
  const [junctionFocus, setJunctionFocus] = useState(false);
  const [navigationProgress, setNavigationProgress] =
    useState<NavigationProgress | null>(null);
  const navigationTrackerRef = useRef<NavigationTrackerState | null>(null);
  const reroutingRef = useRef(false);
  const lastRerouteAtRef = useRef(0);
  const lastRerouteSuccessAtRef = useRef(0);
  const rerouteAbortRef = useRef<AbortController | null>(null);
  const rerouteGenerationRef = useRef(0);
  const destinationRef = useRef<RouteDestination | null>(null);
  const vehicleRef = useRef(vehicle);

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
  }, [destination, navigating, routeProgressModel, routeSteps, vehicle]);

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
  const nextJunctionFocus = navigating
    ? junctionFocus
      ? distanceToNextMeters <= JUNCTION_FOCUS_EXIT_METERS
      : distanceToNextMeters <= JUNCTION_FOCUS_ENTER_METERS
    : false;
  if (nextJunctionFocus !== junctionFocus) {
    setJunctionFocus(nextJunctionFocus);
  }
  const approachingIntersection = navigating && nextJunctionFocus;

  useNavigationVoice({
    enabled: voiceEnabled,
    navigating,
    step: activeNavigationStep,
    distanceMeters: distanceToNextMeters,
    offRoute: navigationProgress?.offRoute ?? false,
    destinationLabel: destination?.label ?? "",
  });

  const {
    origin,
    visible,
    error: cctvError,
    cameraById,
    reload,
  } = useCctvView({
    vehicle,
    gpsStatus,
    viewport,
    route,
    refreshNonce,
  });

  const {
    origin: trafficOrigin,
    scored: trafficScored,
    visible: traffic,
    error: trafficError,
    reload: reloadTraffic,
  } = useTrafficView({
    vehicle,
    gpsStatus,
    viewport,
    route,
    refreshNonce,
    nearbyFocusKm: trafficFocus5km ? CITY_TRAFFIC_FOCUS_KM : null,
  });

  const {
    points: speedEnforcement,
    error: speedEnforcementError,
    reload: reloadSpeedEnforcement,
  } = useSpeedEnforcementView({
    vehicle,
    viewport,
    refreshNonce,
  });

  const {
    alerts: disasters,
    origin: disasterOrigin,
    error: disasterError,
    reload: reloadDisasters,
  } = useDisasterView(refreshNonce);

  const parkingCenter = destination?.location ?? null;
  const {
    lots: parkingLots,
    origin: parkingOrigin,
    error: parkingError,
    fetchedAt: parkingFetchedAt,
  } = useParkingView({
    center: parkingCenter,
    enabled: Boolean(destination) && parkingOpen,
    radiusKm: 4,
  });

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
    const stop = watchVehiclePosition({
      onFix: (pose) => {
        setVehicle(pose);
        const context = navigationContextRef.current;
        if (!context.navigating || !context.routeProgressModel) {
          setDisplayVehicle(null);
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
        setDisplayVehicle(
          snapVehicleToRoute({
            raw: pose,
            model: context.routeProgressModel,
            previousRouteMeters: next?.routeMeters,
          }),
        );
      },
      onStatus: setGpsStatus,
    });
    return stop;
  }, []);

  const visibleAccidents = useMemo(
    () =>
      mapVisibleAccidents(accidents, viewport, {
        lng: vehicle.lng,
        lat: vehicle.lat,
      }),
    [accidents, vehicle.lat, vehicle.lng, viewport],
  );

  const visibleDisasters = useMemo(
    () =>
      pinSelected(
        mapVisibleDisasters(disasters, viewport, {
          lng: vehicle.lng,
          lat: vehicle.lat,
        }),
        selectedEvent?.kind === "disaster" ? selectedEvent.id : null,
        disasters,
      ),
    [disasters, selectedEvent, vehicle.lat, vehicle.lng, viewport],
  );

  const visibleConstructions = useMemo(
    () =>
      mapVisibleConstruction(constructions, viewport, {
        lng: vehicle.lng,
        lat: vehicle.lat,
      }),
    [constructions, vehicle.lat, vehicle.lng, viewport],
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

  const intel = useMemo(() => {
    const cameras = roadIntelFromCameras(visible);
    const trafficItems = deriveTrafficIntel(
      trafficScored,
      trafficFocus5km ? CITY_TRAFFIC_FOCUS_KM : undefined,
    );
    const extras = baseIntel.filter(
      (item) =>
        item.kind !== "cctv" &&
        item.kind !== "congestion" &&
        item.kind !== "disaster" &&
        item.kind !== "accident" &&
        item.kind !== "construction",
    );
    const origin = { lng: vehicle.lng, lat: vehicle.lat };
    return [
      ...trafficItems,
      ...cameras,
      ...deriveConstructionIntel(visibleConstructions, origin),
      ...deriveAccidentIntel(visibleAccidents, origin),
      ...deriveDisasterIntel(visibleDisasters, origin),
      ...extras,
    ];
  }, [
    baseIntel,
    trafficFocus5km,
    trafficScored,
    vehicle.lat,
    vehicle.lng,
    visible,
    visibleAccidents,
    visibleConstructions,
    visibleDisasters,
  ]);

  const searchBias = useMemo(
    () => ({ lng: vehicle.lng, lat: vehicle.lat }),
    [vehicle.lat, vehicle.lng],
  );

  const selectCamera = useCallback(
    (id: string) => {
      const camera = cameraById(id);
      if (!camera) return;
      const center =
        gpsStatus === "active"
          ? { lng: vehicle.lng, lat: vehicle.lat }
          : (viewport?.center ?? { lng: vehicle.lng, lat: vehicle.lat });
      setSelectedEvent({ kind: "cctv", id });
      setEventListKind(null);
      setSelectedCctv({
        ...camera,
        distanceKm: camera.distanceKm ?? distanceKm(center, camera.location),
      });
    },
    [cameraById, gpsStatus, vehicle.lat, vehicle.lng, viewport?.center],
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
  const selectedCongestion = useMemo(() => {
    if (selectedEvent?.kind !== "congestion") return null;
    return (
      trafficScored.find((item) => item.id === selectedEvent.id) ??
      traffic.find((item) => item.id === selectedEvent.id) ??
      null
    );
  }, [selectedEvent, traffic, trafficScored]);

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

  const applyRoute = useCallback(async (hit: GeocodeHit, mode = travelMode) => {
    rememberAddress(hit);
    lastRouteHitRef.current = hit;
    setRouting(true);
    setRouteError(null);
    setSelectedCctv(null);
    setSelectedEvent(null);
    setEventListKind(null);
    try {
      const plan = await planDrivingRoute(
        { lng: vehicle.lng, lat: vehicle.lat },
        hit,
        undefined,
        mode,
      );
      setRoute(plan.coordinates);
      setDestination(plan.destination);
      setManeuver(plan.maneuver);
      setRouteSteps(plan.steps ?? []);
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
  }, [travelMode, vehicle.lat, vehicle.lng]);

  const handleLongPress = useCallback(
    async (location: { lng: number; lat: number }) => {
      const hit = await reversePlace(location);
      addFavorite(hit);
      setFavoritesOpen(true);
      await applyRoute(hit);
    },
    [applyRoute],
  );

  const currentPlace = destination ? destinationToHit(destination) : null;
  const isCurrentFavorite = currentPlace ? isFavorite(currentPlace) : false;

  const handleHeartClick = useCallback(() => {
    setSelectedCctv(null);
    setSelectedEvent(null);
    setEventListKind(null);
    setMusicMode((mode) => (mode === "open" ? "mini" : mode));
    if (currentPlace && !isFavorite(currentPlace)) {
      addFavorite(currentPlace);
      setFavoritesOpen(true);
      return;
    }
    setFavoritesOpen((open) => !open);
  }, [currentPlace]);

  const clearRoute = useCallback(() => {
    setDestination(null);
    setRouteError(null);
    setRoute([]);
    setManeuver(null);
    setRouteSteps([]);
    setFollowVehicle(true);
    setNavigating(false);
    navigationTrackerRef.current = null;
    setNavigationProgress(null);
    setDisplayVehicle(null);
    setParkingOpen(false);
    setSelectedParking(null);
  }, []);

  const locate = useCallback(async () => {
    setGpsStatus("locating");
    try {
      const pose = await requestCurrentPosition();
      setVehicle(pose);
      if (!followVehicle) {
        setFollowOrientation("heading-up");
        setFollowVehicle(true);
      } else {
        setFollowOrientation((current) =>
          current === "heading-up" ? "north-up" : "heading-up",
        );
        setFollowVehicle(true);
      }
      setGpsStatus("active");
      setRefreshNonce((value) => value + 1);
    } catch {
      setGpsStatus("denied");
    }
  }, [followVehicle]);

  const startNavigation = useCallback(() => {
    const next = routeProgressModel
      ? updateNavigationProgress({
          model: routeProgressModel,
          steps: routeSteps,
          vehicle,
          previous: null,
        })
      : null;
    navigationTrackerRef.current = next;
    setNavigationProgress(next);
    setDisplayVehicle(
      routeProgressModel
        ? snapVehicleToRoute({
            raw: vehicle,
            model: routeProgressModel,
            previousRouteMeters: next?.routeMeters,
          })
        : null,
    );
    setNavigating(true);
    setCameraMode("3d");
    setFollowVehicle(true);
    setSelectedCctv(null);
    setSelectedEvent(null);
    setEventListKind(null);
    setIntelCollapse((value) => value + 1);
  }, [routeProgressModel, routeSteps, vehicle]);

  const exitNavigation = useCallback(() => {
    rerouteAbortRef.current?.abort();
    setNavigating(false);
    navigationTrackerRef.current = null;
    setNavigationProgress(null);
    setDisplayVehicle(null);
    setFollowVehicle(false);
    setFitRouteKey((value) => value + 1);
  }, []);

  const refreshIntel = useCallback(() => {
    setRefreshNonce((value) => value + 1);
    reload();
    reloadTraffic();
    reloadSpeedEnforcement();
    reloadDisasters();
  }, [reload, reloadDisasters, reloadSpeedEnforcement, reloadTraffic]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      refreshIntel();
    }, 5 * 60 * 1000);
    return () => window.clearInterval(timer);
  }, [refreshIntel]);

  const rerouteFromHere = useCallback(async () => {
    const dest = destinationRef.current;
    const here = vehicleRef.current;
    if (!dest || reroutingRef.current) return;
    const now = Date.now();
    if (now - lastRerouteSuccessAtRef.current < 8000) return;
    if (now - lastRerouteAtRef.current < 2500) return;
    rerouteAbortRef.current?.abort();
    const controller = new AbortController();
    rerouteAbortRef.current = controller;
    const generation = rerouteGenerationRef.current + 1;
    rerouteGenerationRef.current = generation;
    reroutingRef.current = true;
    lastRerouteAtRef.current = now;
    setRerouting(true);
    setReroutePending(false);
    const staleTimer = window.setTimeout(() => {
      if (
        rerouteGenerationRef.current === generation &&
        reroutingRef.current
      ) {
        setReroutePending(true);
      }
    }, 5000);
    try {
      const plan = await planDrivingRoute(
        { lng: here.lng, lat: here.lat },
        {
          id: "reroute",
          name: dest.label,
          address: dest.address,
          location: dest.location,
        },
        controller.signal,
        travelMode,
      );
      if (generation !== rerouteGenerationRef.current) return;
      setRoute(plan.coordinates);
      setDestination(plan.destination);
      setManeuver(plan.maneuver);
      setRouteSteps(plan.steps ?? []);
      setRouteDurationSeconds(plan.durationSeconds);
      setRouteDistanceMeters(plan.distanceMeters);
      navigationTrackerRef.current = null;
      setNavigationProgress(null);
      lastRerouteSuccessAtRef.current = Date.now();
    } catch (error) {
      if (controller.signal.aborted) return;
      if (generation !== rerouteGenerationRef.current) return;
      setRouteError(error instanceof Error ? error.message : "重新規劃路線失敗");
    } finally {
      window.clearTimeout(staleTimer);
      if (generation === rerouteGenerationRef.current) {
        reroutingRef.current = false;
        setRerouting(false);
        setReroutePending(false);
      }
    }
  }, [travelMode]);

  useEffect(() => {
    if (!navigating || !navigationProgress?.offRoute) return;
    void rerouteFromHere();
  }, [navigating, navigationProgress?.offRoute, rerouteFromHere]);

  useEffect(() => {
    if (!navigating) return;
    const el = navCardRef.current;
    if (!el) return;
    const update = () => {
      const rect = el.getBoundingClientRect();
      setOverlayPadding({
        top: Math.max(90, Math.round(rect.height + 24)),
        left: Math.max(24, Math.round(rect.width + 24)),
        right: 88,
        bottom: 130,
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
  }, [landscape, navigating]);

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
    if (kind === "congestion") return trafficOrigin;
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
        cameraMode={cameraMode}
        followOrientation={followOrientation}
        followVehicle={followVehicle}
        mapDisplayMode={mapDisplayMode}
        styleRevision={styleRevision}
        pickMode={pickMode}
        navigating={navigating}
        selectedCctvId={selectedCctv?.id ?? null}
        selectedDisasterId={selectedDisaster?.id ?? null}
        cameras={mapCameras}
        speedEnforcement={speedEnforcement}
        traffic={traffic}
        disasters={visibleDisasters}
        accidents={visibleAccidents}
        constructions={visibleConstructions}
        selectedAccidentId={selectedAccident?.id ?? null}
        selectedConstructionId={selectedConstruction?.id ?? null}
        layerVisibility={layerVisibility}
        focusTarget={focusTarget}
        parkingLots={parkingLots}
        selectedParkingId={selectedParking?.id ?? null}
        parkingVisible={parkingOpen}
        onParkingSelect={(id) => {
          const found = parkingLots.find((lot) => lot.id === id) ?? null;
          setSelectedParking(found);
          setParkingOpen(true);
          if (found) focusEvent(found.location);
        }}
        route={route}
        routeMeters={navigationProgress?.routeMeters ?? 0}
        distanceToNextMeters={distanceToNextMeters}
        approachingIntersection={approachingIntersection}
        junctionCue={activeNavigationStep?.location ?? null}
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
        }}
        onViewportChange={setViewport}
        onLongPress={(location) => void handleLongPress(location)}
        onPickLocation={(location) => {
          setPickLocation(location);
          setPickAddress(null);
          void reversePlace(location).then((hit) => {
            setPickAddress(hit.address || hit.name || null);
          });
        }}
        onStyleFallback={(message) => {
          setStyleHint(message);
          setMapDisplayMode("dark");
          writeMapDisplayMode("dark");
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
        <div className="absolute top-[max(5.5rem,env(safe-area-inset-top))] left-3 right-3 z-40 sm:left-3 sm:right-auto">
          <PlaceEditor
            type={editingPlaceType}
            existing={
              savedPlaces.find((place) => place.type === editingPlaceType) ?? null
            }
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
              const current =
                savedPlaces.find((place) => place.type === editingPlaceType) ??
                null;
              upsertSavedPlace({
                type: editingPlaceType,
                displayName:
                  current?.displayName ??
                  (editingPlaceType === "home" ? "住家" : "公司"),
                originalAddress: pickAddress ?? undefined,
                latitude: pickLocation.lat,
                longitude: pickLocation.lng,
              });
              setPickMode(false);
              setPickLocation(null);
              setEditingPlaceType(null);
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
              upsertSavedPlace({ type: editingPlaceType, ...input });
              setEditingPlaceType(null);
              setPickMode(false);
            }}
            onRename={(displayName) => {
              const current = savedPlaces.find(
                (place) => place.type === editingPlaceType,
              );
              if (current) renameSavedPlace(current.id, displayName);
            }}
            onDelete={() => {
              const current = savedPlaces.find(
                (place) => place.type === editingPlaceType,
              );
              if (current) deleteSavedPlace(current.id);
              setEditingPlaceType(null);
            }}
            onClose={() => {
              setEditingPlaceType(null);
              setPickMode(false);
              setPickLocation(null);
            }}
          />
        </div>
      ) : null}

      {destination && navigating ? (
        <>
          <div className="absolute top-[calc(env(safe-area-inset-top,0px)+12px)] left-[calc(env(safe-area-inset-left,0px)+12px)] z-30">
            <NextIntersectionHud
              ref={navCardRef}
              step={activeNavigationStep}
              distanceMeters={distanceToNextMeters}
              offRoute={navigationProgress?.offRoute ?? false}
              rerouting={rerouting}
              reroutePending={reroutePending}
              junctionFocus={nextJunctionFocus}
              voiceEnabled={voiceEnabled}
              onToggleVoice={() => setVoiceEnabled((value) => !value)}
            />
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="結束導航"
            onClick={exitNavigation}
            className="pointer-events-auto absolute top-[max(0.4rem,env(safe-area-inset-top))] right-[max(0.65rem,env(safe-area-inset-right))] z-30 size-11 rounded-full border border-white/12 bg-black/72 text-zinc-200 shadow-[0_8px_24px_rgba(0,0,0,0.45)] backdrop-blur-xl hover:bg-black/85 hover:text-white"
          >
            <X className="size-5" />
          </Button>
        </>
      ) : (
        <div
          className={
            destination
              ? "absolute top-[max(0.5rem,env(safe-area-inset-top))] right-3 left-3 z-20 sm:right-24"
              : "absolute top-[max(0.5rem,env(safe-area-inset-top))] right-[4.4rem] left-3 z-20 sm:right-24"
          }
        >
          {destination ? (
            <RouteConfirmBar
              destination={destination}
              maneuver={maneuver}
              travelMode={travelMode}
              durationSeconds={routeDurationSeconds}
              distanceMeters={routeDistanceMeters}
              rerouting={routing || rerouting}
              motorcycleUnsupported={motorcycleUnsupported}
              onTravelMode={(mode) => {
                setTravelMode(mode);
                const hit = lastRouteHitRef.current;
                if (hit) void applyRoute(hit, mode);
              }}
              onStartNav={startNavigation}
              onClear={clearRoute}
              onNearbyParking={() => {
                setParkingOpen(true);
                setSelectedParking(null);
              }}
            />
          ) : (
            <>
              <AddressSearch
                bias={searchBias}
                busy={routing}
                error={routeError}
                onSelect={(hit) => void applyRoute(hit)}
              />
              <SavedPlaceBar
                home={homePlace}
                work={workPlace}
                onGo={(place) => void applyRoute(savedPlaceToHit(place))}
                onEdit={(type) => {
                  setEditingPlaceType(type);
                  setPickMode(false);
                  setPickLocation(null);
                }}
              />
            </>
          )}
        </div>
      )}

      <div className="pointer-events-auto absolute top-[42%] right-[max(0.65rem,env(safe-area-inset-right))] z-20 -translate-y-1/2 sm:top-28 sm:translate-y-0">
        <MapControls
          cameraMode={cameraMode}
          followOrientation={followOrientation}
          followVehicle={followVehicle}
          gpsStatus={gpsStatus}
          mapDisplayMode={mapDisplayMode}
          styleMenuOpen={styleMenuOpen}
          onLocate={() => void locate()}
          onToggleCamera={() =>
            setCameraMode((mode) => (mode === "3d" ? "2d" : "3d"))
          }
          onMapDisplayMode={(mode) => {
            writeMapDisplayMode(mode);
            setMapDisplayMode(mode);
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

      <footer className="absolute inset-x-0 bottom-0 z-10 flex flex-col items-center gap-2 px-2 pb-[max(0.45rem,env(safe-area-inset-bottom))] sm:p-4 sm:pt-0">
        {parkingOpen ? (
          <ParkingPanel
            lots={parkingLots}
            origin={parkingOrigin}
            fetchedAt={parkingFetchedAt}
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
                address: lot.address || lot.name,
                location: lot.location,
              });
            }}
            onClose={() => {
              setParkingOpen(false);
              setSelectedParking(null);
            }}
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
                      address:
                        selectedEventCard.roadName || selectedEventCard.title,
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
        <RoadInformationCard
          key={intelCollapse}
          items={intel}
          origin={origin}
          trafficOrigin={trafficOrigin}
          disasterOrigin={disasterOrigin}
          emptyHint="目前畫面內尚無 CCTV、事故或災害情報。"
          onSelectCctv={selectCamera}
          layerVisibility={layerVisibility}
          activeKind={eventListKind ?? selectedEvent?.kind ?? null}
          onKindClick={handleKindClick}
          musicOpen={musicMode !== "off"}
          favorites={favorites}
          favoritesOpen={favoritesOpen}
          canFavorite={Boolean(currentPlace)}
          isCurrentFavorite={isCurrentFavorite}
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
          account={googleAccount.account}
          accountBusy={googleAccount.busy}
          accountHint={googleAccount.hint}
          accountConfigured={googleAccount.configured}
          accountUnavailable={googleAccount.unavailable}
          onSignIn={googleAccount.signIn}
          onSignOut={googleAccount.signOut}
          onPreviewOpen={() => {
            setFavoritesOpen(false);
            setSelectedCctv(null);
            setSelectedEvent(null);
            setMusicMode((mode) => (mode === "open" ? "mini" : mode));
          }}
          onToggleMusic={() => {
            setFavoritesOpen(false);
            setSelectedCctv(null);
            setSelectedEvent(null);
            setIntelCollapse((value) => value + 1);
            setMusicMode((mode) => {
              if (mode === "off") return "open";
              if (mode === "open") return "mini";
              return "off";
            });
          }}
        />
      </footer>

      {cctvError || trafficError || speedEnforcementError || disasterError || parkingError ? (
        <div className="pointer-events-none absolute top-[max(11rem,calc(env(safe-area-inset-top)+10rem))] left-1/2 z-20 -translate-x-1/2 rounded-xl border border-amber-300/25 bg-black/65 px-3 py-2 text-xs text-amber-100">
          {cctvError ?? trafficError ?? speedEnforcementError ?? disasterError ?? parkingError}
        </div>
      ) : null}
    </div>
  );
}

function Legend() {
  const items = [
    { color: "bg-[#3ee0ff]", label: "導航路線" },
    { color: "bg-[#22c55e]", label: "順暢" },
    { color: "bg-[#facc15]", label: "車多" },
    { color: "bg-[#f97316]", label: "壅塞" },
    { color: "bg-[#ef4444]", label: "嚴重壅塞" },
    { color: "bg-[#7f1d1d]", label: "接近停止" },
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
