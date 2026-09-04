import { maneuverVoiceText, type ManeuverVoiceCue } from "@/lib/maneuver-guidance";
import type { RouteStep } from "@/types/domain";

export type VoicePhase =
  | "start"
  | "voice200"
  | "voice100"
  | "voice30"
  | "offroute"
  | "arrive";

export function spokenInstruction(
  step: RouteStep | null,
  destinationLabel: string,
  phase: VoicePhase,
) {
  if (phase === "start") {
    return destinationLabel ? `開始導航，前往${destinationLabel}` : "開始導航";
  }
  if (phase === "offroute") return "已偏離路線，正在重新規劃";
  if (phase === "arrive") {
    const dest = destinationLabel || step?.roadName || "目的地";
    return `即將抵達${dest}`;
  }
  if (
    phase === "voice200" ||
    phase === "voice100" ||
    phase === "voice30"
  ) {
    return maneuverVoiceText(step, phase satisfies ManeuverVoiceCue);
  }
  return "";
}
