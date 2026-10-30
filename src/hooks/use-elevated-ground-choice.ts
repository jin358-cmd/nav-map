"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  detectElevatedGroundFork,
  elevatedRoadNearby,
  pickForkVias,
} from "@/lib/elevated-ground/fork";
import { distanceToLine, metersAlongRoute } from "@/lib/elevated-ground/geometry";
import {
  canProbeFork,
  initialForkPrompt,
  reduceForkPrompt,
  type ProbeGate,
} from "@/lib/elevated-ground/trigger";
import {
  FORK_DISMISS_MS,
  type ElevatedGroundFork,
  type ForkRoute,
  type LngLatPair,
  type RoadRibbon,
} from "@/lib/elevated-ground/types";
import { fetchForkRoutes } from "@/services/fork-routes";
import type { LngLat, RoutePlan, TravelMode } from "@/types/domain";

export type ReadyFork = {
  fork: ElevatedGroundFork;
  elevatedPlan: RoutePlan;
  groundPlan: RoutePlan;
  dismissMs: number;
};

export type ForkPromptView = {
  active: "elevated" | "ground";
  elevated: ForkRoute;
  ground: ForkRoute;
  dismissMs: number;
};

function asFork(plan: RoutePlan): ForkRoute {
  return {
    coordinates: plan.coordinates,
    distanceMeters: plan.distanceMeters,
    durationSeconds: plan.durationSeconds,
  };
}

function matchPlans(
  first: RoutePlan,
  second: RoutePlan,
  ribbons: RoadRibbon[],
): ReadyFork | null {
  const left = asFork(first);
  const right = asFork(second);
  const fork = detectElevatedGroundFork(left, right, ribbons);
  if (!fork) return null;
  return {
    fork,
    elevatedPlan: fork.elevated === left ? first : second,
    groundPlan: fork.ground === left ? first : second,
    dismissMs: FORK_DISMISS_MS,
  };
}

function pairPlans(plans: RoutePlan[], ribbons: RoadRibbon[]): ReadyFork | null {
  for (let left = 0; left < plans.length; left += 1) {
    for (let right = left + 1; right < plans.length; right += 1) {
      const matched = matchPlans(plans[left], plans[right], ribbons);
      if (matched) return matched;
    }
  }
  return null;
}

function sideOf(route: LngLatPair[], fork: ElevatedGroundFork): "elevated" | "ground" {
  if (route.length === 0) return "elevated";
  const mid = route[Math.floor(route.length / 2)];
  return distanceToLine(mid, fork.elevated.coordinates) <=
    distanceToLine(mid, fork.ground.coordinates)
    ? "elevated"
    : "ground";
}

function aheadZone(ahead: number | null) {
  if (ahead == null) return "none";
  if (ahead > 240) return "far";
  if (ahead < -15) return "passed";
  if (ahead > 200) return "edge";
  if (ahead >= 0) return "in";
  return "hold";
}

export function useElevatedGroundChoice(args: {
  enabled: boolean;
  navigating: boolean;
  offRoute: boolean;
  route: LngLatPair[];
  routeMeters: number;
  origin: LngLat | null;
  destinationLabel: string;
  destination: LngLat | null;
  travelMode: TravelMode;
  ribbons: RoadRibbon[];
  preset: ReadyFork | null;
  onSwap: (plan: RoutePlan) => void;
}) {
  const [discovered, setDiscovered] = useState<ReadyFork | null>(null);
  const [closedId, setClosedId] = useState<string | null>(null);
  const [sessionOn, setSessionOn] = useState(args.navigating);
  const [samples, setSamples] = useState({ signature: "", count: 0 });
  const gateRef = useRef<ProbeGate>({ lastAtMs: 0, negatives: [] });
  const onSwapRef = useRef(args.onSwap);
  const latestRef = useRef(args);

  if (sessionOn !== args.navigating) {
    setSessionOn(args.navigating);
    if (!args.navigating) {
      setDiscovered(null);
      setClosedId(null);
      setSamples({ signature: "", count: 0 });
    }
  }

  const ready = args.preset ?? discovered;
  const decisionMeters = ready
    ? metersAlongRoute(args.route, ready.fork.decision)
    : null;
  const ahead = decisionMeters == null ? null : decisionMeters - args.routeMeters;
  const zone = aheadZone(ahead);
  const hasBridge = useMemo(() => {
    if (!args.enabled || !args.navigating || args.preset) return false;
    return elevatedRoadNearby(args.route, args.ribbons, args.routeMeters);
  }, [args.enabled, args.navigating, args.preset, args.ribbons, args.route, args.routeMeters]);

  const destinationKey = args.destination
    ? `${args.destination.lng.toFixed(4)},${args.destination.lat.toFixed(4)}|${args.destinationLabel}`
    : "";

  useEffect(() => {
    latestRef.current = args;
    onSwapRef.current = args.onSwap;
  });

  useEffect(() => {
    const latest = latestRef.current;
    if (latest.preset || !latest.enabled || !latest.navigating || latest.offRoute) return;
    if (!hasBridge || !latest.destination || !latest.origin) return;
    const key = `${destinationKey}@${Math.round(latest.routeMeters / 400)}`;
    if (!canProbeFork(gateRef.current, Date.now(), latest.routeMeters, key)) return;
    const controller = new AbortController();
    const destination = latest.destination;
    const origin = latest.origin;
    const label = latest.destinationLabel;
    const mode = latest.travelMode;
    const routeNow = latest.route;
    const ribbonsNow = latest.ribbons;
    const metersNow = latest.routeMeters;
    gateRef.current.lastAtMs = Date.now();
    void (async () => {
      const alternatives = await fetchForkRoutes({
        from: origin,
        to: destination,
        label,
        mode,
        signal: controller.signal,
      });
      if (controller.signal.aborted) return;
      let found = pairPlans(alternatives, ribbonsNow);
      if (!found) {
        const vias = pickForkVias(routeNow, ribbonsNow, metersNow);
        if (vias) {
          const [elevatedRoutes, groundRoutes] = await Promise.all([
            fetchForkRoutes({
              from: origin,
              to: destination,
              label,
              mode,
              via: { lng: vias.elevated[0], lat: vias.elevated[1] },
              signal: controller.signal,
            }),
            fetchForkRoutes({
              from: origin,
              to: destination,
              label,
              mode,
              via: { lng: vias.ground[0], lat: vias.ground[1] },
              signal: controller.signal,
            }),
          ]);
          const elevated = elevatedRoutes[0];
          const ground = groundRoutes[0];
          if (elevated && ground) found = matchPlans(elevated, ground, ribbonsNow);
        }
      }
      if (controller.signal.aborted) return;
      if (!found) {
        gateRef.current.negatives = [
          ...gateRef.current.negatives.filter((item) => item.key !== key),
          { key, atMs: Date.now(), routeMeters: metersNow },
        ];
        return;
      }
      setDiscovered(found);
    })();
    return () => controller.abort();
  }, [
    args.enabled,
    args.navigating,
    args.offRoute,
    args.preset,
    args.travelMode,
    destinationKey,
    hasBridge,
  ]);

  const forkKey = ready?.fork.id ?? "";
  const signature = `${forkKey}|${zone}|${args.navigating}|${args.offRoute}|${closedId ?? ""}`;
  if (samples.signature !== signature) {
    setSamples({ signature, count: 1 });
  } else if (samples.count < 2) {
    setSamples({ signature, count: samples.count + 1 });
  }
  const promptInput = {
    navigating: args.navigating && ahead != null,
    offRoute: args.offRoute,
    choiceMade: closedId != null && closedId === forkKey,
    dismissed: closedId != null && closedId === forkKey,
    aheadMeters: ahead ?? 9999,
  };
  const prompt = reduceForkPrompt(
    samples.signature === signature && samples.count >= 2
      ? { visible: false, pending: true }
      : initialForkPrompt(),
    promptInput,
  );

  useEffect(() => {
    if (!prompt.visible || !ready || closedId === ready.fork.id) return;
    const forkId = ready.fork.id;
    const timer = window.setTimeout(() => setClosedId(forkId), ready.dismissMs);
    return () => window.clearTimeout(timer);
  }, [closedId, prompt.visible, ready]);

  const choose = (side: "elevated" | "ground") => {
    if (!ready) return;
    const active = sideOf(args.route, ready.fork);
    setClosedId(ready.fork.id);
    if (side === active) return;
    onSwapRef.current(side === "elevated" ? ready.elevatedPlan : ready.groundPlan);
  };

  const view: ForkPromptView | null =
    ready && prompt.visible && closedId !== ready.fork.id
      ? {
          active: sideOf(args.route, ready.fork),
          elevated: {
            coordinates: ready.fork.elevated.coordinates,
            distanceMeters: ready.elevatedPlan.distanceMeters,
            durationSeconds: ready.elevatedPlan.durationSeconds,
          },
          ground: {
            coordinates: ready.fork.ground.coordinates,
            distanceMeters: ready.groundPlan.distanceMeters,
            durationSeconds: ready.groundPlan.durationSeconds,
          },
          dismissMs: ready.dismissMs,
        }
      : null;

  return { prompt: view, choose };
}
