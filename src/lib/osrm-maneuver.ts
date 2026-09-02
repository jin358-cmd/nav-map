import type { NavigationManeuver } from "@/types/domain";

type OsrmStep = {
  name?: string;
  distance?: number;
  maneuver?: {
    type?: string;
    modifier?: string;
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

const ACTION_BY_TYPE: Record<string, string> = {
  depart: "出發",
  arrive: "抵達",
  merge: "匯入車道",
  "on ramp": "上匝道",
  "off ramp": "下匝道",
  fork: "走分岔",
  roundabout: "進入圓環",
  rotary: "進入圓環",
  continue: "繼續前行",
  "new name": "繼續前行",
};

export function actionFromOsrmStep(step: OsrmStep): string {
  const type = step.maneuver?.type ?? "";
  const modifier = step.maneuver?.modifier ?? "";
  if (type === "arrive") return "抵達";
  if (type === "depart") return "出發";
  if (modifier && ACTION_BY_MODIFIER[modifier]) return ACTION_BY_MODIFIER[modifier];
  return ACTION_BY_TYPE[type] || "繼續前行";
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
