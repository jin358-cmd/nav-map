"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useState } from "react";
import { MapControls } from "@/components/map/map-controls";
import { AddressSearch } from "@/components/overlay/address-search";
import { CctvDetailCard } from "@/components/overlay/cctv-detail-card";
import { RoadInformationCard } from "@/components/overlay/road-information-card";
import { RoutePreview } from "@/components/overlay/route-preview";
import { useCctvView } from "@/hooks/use-cctv-view";
import { useTrafficView } from "@/hooks/use-traffic-view";
import { roadIntelFromCameras } from "@/lib/cctv-intel";
import { DEMO_VEHICLE } from "@/lib/constants";
import { distanceKm } from "@/lib/geo";
import { deriveTrafficIntel } from "@/lib/traffic-intel";
import {
  fetchAccidentReports,
  fetchAheadIntel,
  fetchDemoRoute,
  fetchDisasterAlerts,
  fetchNavigationManeuver,
  planDrivingRoute,
  requestCurrentPosition,
  watchVehiclePosition,
} from "@/services";
import type {
  AccidentReport,
  CameraMode,
  CctvCamera,
  DisasterAlert,
  GeocodeHit,
  GpsStatus,
  MapViewport,
  NavigationManeuver,
  RoadIntelItem,
  RouteDestination,
  RouteStep,
  VehiclePose,
} from "@/types/domain";

const DrivingMap = dynamic(
  () => import("@/components/map/driving-map").then((mod) => mod.DrivingMap),
  {
    ssr: false,
    loading: () => (
      <div className="absolute inset-0 bg-[#0b0d11]">
        <div className="flex h-full items-center justify-center text-sm text-zinc-400">
          載入臺南駕駛地圖…
        </div>
      </div>
    ),
  },
);

export function DrivingApp() {
  const [vehicle, setVehicle] = useState<VehiclePose>(DEMO_VEHICLE);
  const [cameraMode, setCameraMode] = useState<CameraMode>("3d");
  const [followVehicle, setFollowVehicle] = useState(true);
  const [gpsStatus, setGpsStatus] = useState<GpsStatus>("idle");
  const [viewport, setViewport] = useState<MapViewport | null>(null);
  const [refreshNonce, setRefreshNonce] = useState(0);
  const [disasters, setDisasters] = useState<DisasterAlert[]>([]);
  const [accidents, setAccidents] = useState<AccidentReport[]>([]);
  const [route, setRoute] = useState<[number, number][]>([]);
  const [demoRoute, setDemoRoute] = useState<[number, number][]>([]);
  const [maneuver, setManeuver] = useState<NavigationManeuver | null>(null);
  const [demoManeuver, setDemoManeuver] = useState<NavigationManeuver | null>(
    null,
  );
  const [destination, setDestination] = useState<RouteDestination | null>(null);
  const [routeSteps, setRouteSteps] = useState<RouteStep[]>([]);
  const [fitRouteKey, setFitRouteKey] = useState(0);
  const [routing, setRouting] = useState(false);
  const [routeError, setRouteError] = useState<string | null>(null);
  const [baseIntel, setBaseIntel] = useState<RoadIntelItem[]>([]);
  const [selectedCctv, setSelectedCctv] = useState<CctvCamera | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [navigating, setNavigating] = useState(false);
  const [intelCollapse, setIntelCollapse] = useState(0);

  const {
    origin,
    preview,
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
  });

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const [disasterRows, accidentRows, routeLine, nav, ahead] =
          await Promise.all([
            fetchDisasterAlerts(),
            fetchAccidentReports(),
            fetchDemoRoute(),
            fetchNavigationManeuver(),
            fetchAheadIntel(),
          ]);
        if (cancelled) return;
        setDisasters(disasterRows);
        setAccidents(accidentRows);
        setDemoRoute(routeLine);
        setRoute(routeLine);
        setDemoManeuver(nav);
        setManeuver(nav);
        setBaseIntel(ahead);
      } catch {
        if (!cancelled) setLoadError("道路情報載入失敗，請重新整理。");
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const stop = watchVehiclePosition({
      onFix: (pose) => {
        setVehicle(pose);
      },
      onStatus: setGpsStatus,
    });
    return stop;
  }, []);

  const intel = useMemo(() => {
    const cameras = roadIntelFromCameras(preview, [], 2);
    const trafficItem = deriveTrafficIntel(trafficScored);
    const extras = baseIntel.filter(
      (item) => item.kind !== "cctv" && item.kind !== "congestion",
    );
    return [
      ...(trafficItem ? [trafficItem] : []),
      ...cameras,
      ...extras,
    ];
  }, [baseIntel, preview, trafficScored]);

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
      setSelectedCctv({
        ...camera,
        distanceKm: camera.distanceKm ?? distanceKm(center, camera.location),
      });
    },
    [cameraById, gpsStatus, vehicle.lat, vehicle.lng, viewport?.center],
  );

  const applyRoute = useCallback(async (hit: GeocodeHit) => {
    setRouting(true);
    setRouteError(null);
    setSelectedCctv(null);
    try {
      const plan = await planDrivingRoute(
        { lng: vehicle.lng, lat: vehicle.lat },
        hit,
      );
      setRoute(plan.coordinates);
      setDestination(plan.destination);
      setManeuver(plan.maneuver);
      setRouteSteps(plan.steps ?? []);
      setFollowVehicle(false);
      setNavigating(false);
      setFitRouteKey((value) => value + 1);
    } catch (error) {
      setRouteError(error instanceof Error ? error.message : "路線規劃失敗");
    } finally {
      setRouting(false);
    }
  }, [vehicle.lat, vehicle.lng]);

  const clearRoute = useCallback(() => {
    setDestination(null);
    setRouteError(null);
    setRoute(demoRoute);
    setManeuver(demoManeuver);
    setRouteSteps([]);
    setFollowVehicle(true);
    setNavigating(false);
  }, [demoManeuver, demoRoute]);

  const locate = useCallback(async () => {
    setGpsStatus("locating");
    try {
      const pose = await requestCurrentPosition();
      setVehicle(pose);
      setFollowVehicle(true);
      setGpsStatus("active");
      setRefreshNonce((value) => value + 1);
    } catch {
      setGpsStatus("denied");
    }
  }, []);

  const goDemoDrive = useCallback(() => {
    setVehicle(DEMO_VEHICLE);
    setFollowVehicle(true);
    setNavigating(false);
    setSelectedCctv(null);
    setCameraMode("3d");
    setDestination(null);
    setRouteError(null);
    setRoute(demoRoute);
    setManeuver(demoManeuver);
    setRouteSteps([]);
    setRefreshNonce((value) => value + 1);
  }, [demoManeuver, demoRoute]);

  const startNavigation = useCallback(() => {
    setNavigating(true);
    setCameraMode("3d");
    setFollowVehicle(true);
    setSelectedCctv(null);
    setIntelCollapse((value) => value + 1);
  }, []);

  const refreshIntel = useCallback(() => {
    setRefreshNonce((value) => value + 1);
    reload();
    reloadTraffic();
  }, [reload, reloadTraffic]);

  return (
    <div className="relative h-dvh w-full overflow-hidden overscroll-none bg-[#0b0d11] text-zinc-100">
      <DrivingMap
        vehicle={vehicle}
        cameraMode={cameraMode}
        followVehicle={followVehicle}
        navigating={navigating}
        selectedCctvId={selectedCctv?.id ?? null}
        cameras={visible}
        traffic={traffic}
        disasters={disasters}
        accidents={accidents}
        route={route}
        destination={destination}
        fitRouteKey={fitRouteKey}
        onCctvSelect={selectCamera}
        onUserPan={() => {
          setFollowVehicle(false);
        }}
        onViewportChange={setViewport}
      />

      <div className="driving-vignette pointer-events-none absolute inset-0" />

      <div className="pointer-events-none absolute top-[max(0.45rem,env(safe-area-inset-top))] left-3 z-10 max-w-[42%] rounded-2xl border border-white/10 bg-black/45 px-2.5 py-1.5 backdrop-blur-md sm:max-w-none sm:px-3 sm:py-2">
        <p className="hidden text-[10px] tracking-[0.18em] text-cyan-200/80 sm:block">
          SMART ROAD
        </p>
        <p className="text-xs font-semibold sm:text-sm">智路臺灣 · 臺南</p>
      </div>

      <div className="absolute top-[max(2.85rem,calc(env(safe-area-inset-top)+2.35rem))] right-[4.4rem] left-3 z-20 sm:top-[max(0.55rem,env(safe-area-inset-top))] sm:right-24 sm:left-44">
        {destination ? (
          <RoutePreview
            destination={destination}
            maneuver={maneuver}
            steps={routeSteps}
            navigating={navigating}
            onStartNav={startNavigation}
            onClear={clearRoute}
          />
        ) : (
          <AddressSearch
            bias={searchBias}
            busy={routing}
            error={routeError}
            onSelect={(hit) => void applyRoute(hit)}
          />
        )}
      </div>

      <div className="pointer-events-auto absolute top-[42%] right-[max(0.65rem,env(safe-area-inset-right))] z-20 -translate-y-1/2 sm:top-28 sm:translate-y-0">
        <MapControls
          cameraMode={cameraMode}
          gpsStatus={gpsStatus}
          followVehicle={followVehicle}
          onLocate={() => void locate()}
          onToggleCamera={() =>
            setCameraMode((mode) => (mode === "3d" ? "2d" : "3d"))
          }
          onRecenter={() => {
            setFollowVehicle(true);
            if (navigating) setCameraMode("3d");
          }}
          onDemoDrive={goDemoDrive}
          onRefreshIntel={refreshIntel}
        />
      </div>

      <div className="pointer-events-none absolute bottom-28 left-2 z-10 hidden max-w-[11rem] sm:bottom-36 sm:left-3 sm:block">
        <Legend />
      </div>

      <footer className="absolute inset-x-0 bottom-0 z-10 flex justify-center px-2 pb-[max(0.45rem,env(safe-area-inset-bottom))] sm:p-4 sm:pt-0">
        {selectedCctv ? (
          <CctvDetailCard
            key={selectedCctv.id}
            camera={selectedCctv}
            onClose={() => setSelectedCctv(null)}
          />
        ) : (
          <RoadInformationCard
            key={intelCollapse}
            items={intel}
            origin={origin}
            trafficOrigin={trafficOrigin}
            emptyHint="附近 8 公里內尚無路況或 CCTV 情報。"
            onSelectCctv={selectCamera}
          />
        )}
      </footer>

      {loadError ? (
        <div className="absolute top-1/2 left-1/2 z-20 -translate-x-1/2 -translate-y-1/2 rounded-xl border border-red-400/30 bg-black/70 px-4 py-3 text-sm text-red-200">
          {loadError}
        </div>
      ) : null}
      {cctvError || trafficError ? (
        <div className="pointer-events-none absolute top-[max(11rem,calc(env(safe-area-inset-top)+10rem))] left-1/2 z-20 -translate-x-1/2 rounded-xl border border-amber-300/25 bg-black/65 px-3 py-2 text-xs text-amber-100">
          {cctvError ?? trafficError}
        </div>
      ) : null}
    </div>
  );
}

function Legend() {
  const items = [
    { color: "bg-[#3ee0ff]", label: "導航路線" },
    { color: "bg-[#ffb020]", label: "車多" },
    { color: "bg-[#ff6b35]", label: "壅塞" },
    { color: "bg-[#c084fc]", label: "CCTV" },
    { color: "bg-[#ff3b3b]", label: "事故" },
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
