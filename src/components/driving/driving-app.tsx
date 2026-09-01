"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useState } from "react";
import { MapControls } from "@/components/map/map-controls";
import { CctvDetailCard } from "@/components/overlay/cctv-detail-card";
import { NavigationBanner } from "@/components/overlay/navigation-banner";
import { RoadInformationCard } from "@/components/overlay/road-information-card";
import { DEMO_VEHICLE } from "@/lib/constants";
import {
  fetchAccidentReports,
  fetchAheadIntel,
  fetchDemoRoute,
  fetchDisasterAlerts,
  fetchNavigationManeuver,
  fetchTainanCctv,
  fetchTainanTraffic,
  requestCurrentPosition,
  watchVehiclePosition,
} from "@/services";
import type {
  AccidentReport,
  CameraMode,
  CctvCamera,
  DisasterAlert,
  GpsStatus,
  NavigationManeuver,
  RoadIntelItem,
  TrafficSegment,
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
  const [cameras, setCameras] = useState<CctvCamera[]>([]);
  const [traffic, setTraffic] = useState<TrafficSegment[]>([]);
  const [disasters, setDisasters] = useState<DisasterAlert[]>([]);
  const [accidents, setAccidents] = useState<AccidentReport[]>([]);
  const [route, setRoute] = useState<[number, number][]>([]);
  const [maneuver, setManeuver] = useState<NavigationManeuver | null>(null);
  const [intel, setIntel] = useState<RoadIntelItem[]>([]);
  const [selectedCctv, setSelectedCctv] = useState<CctvCamera | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const [
          cctvRows,
          trafficRows,
          disasterRows,
          accidentRows,
          routeLine,
          nav,
          ahead,
        ] = await Promise.all([
          fetchTainanCctv(),
          fetchTainanTraffic(),
          fetchDisasterAlerts(),
          fetchAccidentReports(),
          fetchDemoRoute(),
          fetchNavigationManeuver(),
          fetchAheadIntel(),
        ]);
        if (cancelled) return;
        setCameras(cctvRows);
        setTraffic(trafficRows);
        setDisasters(disasterRows);
        setAccidents(accidentRows);
        setRoute(routeLine);
        setManeuver(nav);
        setIntel(ahead);
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
        setFollowVehicle(true);
      },
      onStatus: setGpsStatus,
    });
    return stop;
  }, []);

  const locate = useCallback(async () => {
    setGpsStatus("locating");
    try {
      const pose = await requestCurrentPosition();
      setVehicle(pose);
      setFollowVehicle(true);
      setGpsStatus("active");
    } catch {
      setGpsStatus("denied");
    }
  }, []);

  const goDemoDrive = useCallback(() => {
    setVehicle(DEMO_VEHICLE);
    setFollowVehicle(true);
    setSelectedCctv(null);
    setCameraMode("3d");
  }, []);

  return (
    <div className="relative h-dvh w-full overflow-hidden bg-[#0b0d11] text-zinc-100">
      <DrivingMap
        vehicle={vehicle}
        cameraMode={cameraMode}
        followVehicle={followVehicle}
        selectedCctvId={selectedCctv?.id ?? null}
        cameras={cameras}
        traffic={traffic}
        disasters={disasters}
        accidents={accidents}
        route={route}
        onCctvSelect={setSelectedCctv}
        onUserPan={() => setFollowVehicle(false)}
      />

      <div className="driving-vignette pointer-events-none absolute inset-0" />

      <header className="pointer-events-none absolute inset-x-0 top-0 z-10 flex flex-col gap-3 p-3 pt-[max(0.75rem,env(safe-area-inset-top))] sm:p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="pointer-events-none rounded-2xl border border-white/10 bg-black/45 px-3 py-2 backdrop-blur-md">
            <p className="text-[11px] tracking-[0.18em] text-cyan-200/80">
              SMART ROAD
            </p>
            <p className="text-sm font-semibold">智路臺灣 · 臺南</p>
          </div>
          <div className="pointer-events-auto">
            <MapControls
              cameraMode={cameraMode}
              gpsStatus={gpsStatus}
              followVehicle={followVehicle}
              onLocate={() => void locate()}
              onToggleCamera={() =>
                setCameraMode((mode) => (mode === "3d" ? "2d" : "3d"))
              }
              onRecenter={() => setFollowVehicle(true)}
              onDemoDrive={goDemoDrive}
            />
          </div>
        </div>
        <div className="flex justify-center">
          <NavigationBanner maneuver={maneuver} />
        </div>
      </header>

      <div className="pointer-events-none absolute bottom-0 left-0 z-10 hidden max-w-[11rem] p-3 sm:block">
        <Legend />
      </div>

      <footer className="absolute inset-x-0 bottom-0 z-10 flex justify-center p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:p-4">
        {selectedCctv ? (
          <CctvDetailCard
            camera={selectedCctv}
            onClose={() => setSelectedCctv(null)}
          />
        ) : (
          <RoadInformationCard items={intel} />
        )}
      </footer>

      {loadError ? (
        <div className="absolute top-1/2 left-1/2 z-20 -translate-x-1/2 -translate-y-1/2 rounded-xl border border-red-400/30 bg-black/70 px-4 py-3 text-sm text-red-200">
          {loadError}
        </div>
      ) : null}

      <p className="pointer-events-none absolute right-3 bottom-28 z-10 hidden text-[10px] text-zinc-500 sm:block">
        {gpsStatus === "active"
          ? "GPS 定位中"
          : gpsStatus === "denied"
            ? "定位未授權 · 示範臺南"
            : "示範駕駛視角"}
      </p>
    </div>
  );
}

function Legend() {
  const items = [
    { color: "bg-[#3ee0ff]", label: "導航路線" },
    { color: "bg-[#c084fc]", label: "CCTV" },
    { color: "bg-[#ff3b3b]", label: "事故" },
    { color: "bg-[#ff6b35]", label: "壅塞" },
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
