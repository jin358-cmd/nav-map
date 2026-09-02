import { formatDistance } from "@/lib/format";
import type { LngLat, NavigationManeuver, RouteStep } from "@/types/domain";

export type OsrmStep = {
  name?: string;
  distance?: number;
  maneuver?: {
    type?: string;
    modifier?: string;
    exit?: number;
    location?: [number, number];
  };
};

const ACTION_BY_MODIFIER: Record<string, string> = {
  left: "左轉",
  right: "右轉",
  "sharp left": "大左轉",
  "sharp right": "大右轉",
  "slight left": "靠左",
  "slight right": "靠右",
  straight: "直行",
  uturn: "迴轉",
};

const ALWAYS_INCLUDE = new Set([
  "depart",
  "arrive",
  "turn",
  "merge",
  "on ramp",
  "off ramp",
  "fork",
  "end of road",
  "roundabout",
  "rotary",
  "roundabout turn",
  "exit roundabout",
  "exit rotary",
]);

export function actionFromOsrmStep(step: OsrmStep): string {
  const type = step.maneuver?.type ?? "";
  const modifier = step.maneuver?.modifier ?? "";
  const exit = step.maneuver?.exit;

  if (type === "arrive") return "抵達";
  if (type === "depart") return "出發";
  if (
    type === "roundabout" ||
    type === "rotary" ||
    type === "exit roundabout" ||
    type === "exit rotary" ||
    type === "roundabout turn"
  ) {
    return exit ? `圓環第${exit}出口` : "進入圓環";
  }
  if (type === "on ramp") return "上匝道";
  if (type === "off ramp") return "下匝道";
  if (type === "merge") return "匯入車道";
  if (type === "fork") {
    if (modifier === "left") return "走左側分岔";
    if (modifier === "right") return "走右側分岔";
    return "走分岔";
  }
  if (modifier && ACTION_BY_MODIFIER[modifier]) return ACTION_BY_MODIFIER[modifier];
  if (type === "new name") return "進入";
  if (type === "continue") return "繼續前行";
  if (type === "end of road") return "路口";
  return "繼續前行";
}

export function shouldIncludeOsrmStep(step: OsrmStep): boolean {
  const type = step.maneuver?.type ?? "";
  const distance = step.distance ?? 0;
  const name = step.name?.trim() ?? "";

  if (type === "notification") return false;
  if (ALWAYS_INCLUDE.has(type)) return true;
  if (type === "new name") {
    if (name) return distance >= 25;
    return distance >= 80;
  }
  if (type === "continue") return distance >= 120;
  return distance >= 50;
}

function locationFromManeuver(step: OsrmStep): LngLat | undefined {
  const loc = step.maneuver?.location;
  if (!loc || loc.length < 2) return undefined;
  const [lng, lat] = loc;
  if (!Number.isFinite(lng) || !Number.isFinite(lat)) return undefined;
  return { lng, lat };
}

export function stepsFromOsrm(
  rawSteps: OsrmStep[],
  destinationLabel: string,
): RouteStep[] {
  const steps: RouteStep[] = [];
  let pendingCue = 0;
  let cumulative = 0;

  rawSteps.forEach((step, index) => {
    const distance = Math.max(0, step.distance ?? 0);
    const type = step.maneuver?.type ?? "continue";
    const include = shouldIncludeOsrmStep(step);

    if (!include) {
      pendingCue += distance;
      cumulative += distance;
      return;
    }

    const roadName =
      type === "arrive"
        ? destinationLabel
        : (step.name?.trim() ?? "");
    const modifier = step.maneuver?.modifier?.trim();

    steps.push({
      id: `step-${index}`,
      action: actionFromOsrmStep(step),
      roadName,
      distanceMeters: Math.round(distance),
      cueMeters: Math.round(type === "depart" ? 0 : pendingCue),
      cumulativeMeters: Math.round(cumulative + distance),
      type,
      ...(modifier ? { modifier } : {}),
      location: locationFromManeuver(step),
    });

    pendingCue = distance;
    cumulative += distance;
  });

  return steps;
}

export function instructionForStep(
  step: RouteStep,
  destinationLabel: string,
): string {
  if (step.type === "depart") {
    return step.roadName ? `出發 · ${step.roadName}` : "出發";
  }
  if (step.type === "arrive") {
    const dest = destinationLabel || step.roadName || "目的地";
    if (step.cueMeters > 0) {
      return `${formatDistance(step.cueMeters)}後抵達${dest}`;
    }
    return `抵達 ${dest}`;
  }
  const cue = formatDistance(Math.max(step.cueMeters, 0));
  if (step.roadName) {
    return `${cue}後${step.action}進入${step.roadName}`;
  }
  return `${cue}後${step.action}`;
}

export function maneuverFromOsrm(
  steps: OsrmStep[],
  destinationLabel: string,
  distanceMeters: number,
  durationSeconds: number,
): NavigationManeuver {
  const useful =
    steps.find(
      (step) =>
        step.maneuver?.type &&
        step.maneuver.type !== "depart" &&
        (step.distance ?? 0) > 20,
    ) ?? steps[0];

  const action = useful ? actionFromOsrmStep(useful) : "前往";
  const roadName = useful?.name?.trim() || destinationLabel;

  return {
    distanceMeters: Math.round(useful?.distance ?? distanceMeters),
    action,
    roadName,
    hint: `前往${destinationLabel}`,
    remainingKm: Math.max(distanceMeters / 1000, 0.1),
    etaMinutes: Math.max(1, Math.round(durationSeconds / 60)),
  };
}
