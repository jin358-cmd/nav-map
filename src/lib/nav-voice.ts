import type { RouteStep } from "@/types/domain";

export type VoicePhase = "start" | "far" | "near" | "now" | "offroute" | "arrive";

export function spokenDistance(meters: number) {
  if (meters >= 1000) {
    const km = meters / 1000;
    return `${km >= 10 ? Math.round(km) : km.toFixed(1).replace(/\.0$/, "")}公里`;
  }
  if (meters >= 80) return `${Math.round(meters / 10) * 10}公尺`;
  if (meters >= 25) return `${Math.round(meters / 5) * 5}公尺`;
  return "";
}

export function spokenInstruction(
  step: RouteStep | null,
  distanceMeters: number,
  destinationLabel: string,
  phase: VoicePhase,
) {
  if (phase === "start") {
    return destinationLabel ? `開始導航，前往${destinationLabel}` : "開始導航";
  }
  if (phase === "offroute") return "已偏離路線，正在重新規劃";
  if (!step) return "";

  if (step.type === "arrive" || phase === "arrive") {
    const dest = destinationLabel || step.roadName || "目的地";
    return distanceMeters < 30 ? `即將抵達${dest}` : `前方即將抵達${dest}`;
  }

  const action = step.action || "繼續前行";
  const road = step.roadName ? `進入${step.roadName}` : "";
  if (phase === "now") return `即將${action}${road}`;
  const dist = spokenDistance(distanceMeters);
  if (!dist) return `即將${action}${road}`;
  return `前方${dist}，${action}${road}`;
}

export function voicePhaseForDistance(
  distanceMeters: number,
  stepType?: string,
): VoicePhase | null {
  if (stepType === "arrive" && distanceMeters <= 40) return "arrive";
  if (distanceMeters <= 28) return "now";
  if (distanceMeters <= 90) return "near";
  if (distanceMeters <= 280) return "far";
  return null;
}
