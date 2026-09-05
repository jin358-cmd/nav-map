import {
  MANEUVER_AFTER_TURN_METERS,
  MANEUVER_APPROACH_EXIT_METERS,
  MANEUVER_APPROACH_METERS,
  MANEUVER_IMMINENT_METERS,
  MANEUVER_PREPARE_EXIT_METERS,
  MANEUVER_PREPARE_METERS,
} from "@/lib/constants";
import { sliceRouteAhead } from "@/lib/upcoming-route";
import type { RouteStep } from "@/types/domain";

export type ManeuverAlertPhase =
  | "cruise"
  | "prepare"
  | "approach"
  | "imminent";

export type ManeuverVoiceCue = "voice200" | "voice100" | "voice30";

export type ManeuverVoiceFlags = {
  stepId: string;
  voice200Played: boolean;
  voice100Played: boolean;
  voice30Played: boolean;
};

const TURN_TYPES = new Set([
  "turn",
  "merge",
  "on ramp",
  "off ramp",
  "fork",
  "end of road",
  "roundabout turn",
  "exit roundabout",
  "exit rotary",
  "roundabout",
  "rotary",
]);

const TURN_MODIFIER_KEYS = [
  "sharp left",
  "sharp right",
  "slight left",
  "slight right",
  "uturn",
  "left",
  "right",
];

export function emptyManeuverVoiceFlags(stepId: string): ManeuverVoiceFlags {
  return {
    stepId,
    voice200Played: false,
    voice100Played: false,
    voice30Played: false,
  };
}

export function isTurnManeuver(step: RouteStep | null | undefined) {
  if (!step) return false;
  const type = step.type ?? "";
  if (type === "depart" || type === "arrive" || type === "notification") {
    return false;
  }

  const modifier = (step.modifier ?? "").toLowerCase();
  if (modifier.includes("straight")) {
    return TURN_TYPES.has(type) && type !== "continue" && type !== "new name";
  }
  if (TURN_MODIFIER_KEYS.some((key) => modifier.includes(key))) return true;
  if (TURN_TYPES.has(type)) return true;
  return false;
}

let latchedAlertPhase: ManeuverAlertPhase = "cruise";

export function deriveManeuverAlertPhase(
  navigating: boolean,
  isTurn: boolean,
  distanceMeters: number,
  nextTurnDistance?: number,
): ManeuverAlertPhase {
  const next = nextManeuverAlertPhase(
    navigating,
    isTurn,
    distanceMeters,
    latchedAlertPhase,
    nextTurnDistance,
  );
  latchedAlertPhase = next;
  return next;
}

export function nextManeuverAlertPhase(
  navigating: boolean,
  isTurn: boolean,
  distanceMeters: number,
  previous: ManeuverAlertPhase,
  nextTurnDistance?: number,
): ManeuverAlertPhase {
  if (!navigating) {
    latchedAlertPhase = "cruise";
    return "cruise";
  }
  const chained =
    (previous === "approach" || previous === "imminent") &&
    nextTurnDistance != null &&
    Number.isFinite(nextTurnDistance) &&
    nextTurnDistance <= MANEUVER_APPROACH_METERS;
  if (!isTurn || !Number.isFinite(distanceMeters)) {
    if (chained && nextTurnDistance != null) {
      return nextTurnDistance <= MANEUVER_IMMINENT_METERS
        ? "imminent"
        : "approach";
    }
    latchedAlertPhase = "cruise";
    return "cruise";
  }
  if (distanceMeters <= MANEUVER_IMMINENT_METERS) return "imminent";
  if (distanceMeters <= MANEUVER_APPROACH_METERS) return "approach";
  if (
    (previous === "approach" || previous === "imminent") &&
    distanceMeters <= MANEUVER_APPROACH_EXIT_METERS
  ) {
    return "approach";
  }
  if (distanceMeters <= MANEUVER_PREPARE_METERS) return "prepare";
  if (previous === "prepare" && distanceMeters <= MANEUVER_PREPARE_EXIT_METERS) {
    return "prepare";
  }
  return "cruise";
}

export function maneuverAlertActive(phase: ManeuverAlertPhase) {
  return phase === "approach" || phase === "imminent";
}

export function maneuverOrangeRouteActive(phase: ManeuverAlertPhase) {
  return phase === "prepare" || phase === "approach" || phase === "imminent";
}

export function takeManeuverVoiceCue(
  previous: ManeuverVoiceFlags | null,
  stepId: string,
  distanceMeters: number,
  isTurn: boolean,
): { flags: ManeuverVoiceFlags; cue: ManeuverVoiceCue | null } {
  const flags =
    previous?.stepId === stepId
      ? { ...previous }
      : emptyManeuverVoiceFlags(stepId);

  if (!isTurn || !stepId || !Number.isFinite(distanceMeters)) {
    return { flags, cue: null };
  }

  if (distanceMeters <= MANEUVER_IMMINENT_METERS && !flags.voice30Played) {
    flags.voice200Played = true;
    flags.voice100Played = true;
    flags.voice30Played = true;
    return { flags, cue: "voice30" };
  }
  if (distanceMeters <= MANEUVER_APPROACH_METERS && !flags.voice100Played) {
    flags.voice200Played = true;
    flags.voice100Played = true;
    return { flags, cue: "voice100" };
  }
  if (distanceMeters <= MANEUVER_PREPARE_METERS && !flags.voice200Played) {
    flags.voice200Played = true;
    return { flags, cue: "voice200" };
  }
  return { flags, cue: null };
}

export function maneuverVoiceText(
  step: RouteStep | null,
  cue: ManeuverVoiceCue,
) {
  const action = step?.action?.trim() || "轉向";
  if (cue === "voice30") return `前方${action}`;
  if (cue === "voice100") return `前方100公尺${action}`;
  return `前方200公尺${action}`;
}

export function maneuverMarqueeIntensity(distanceMeters: number) {
  if (!Number.isFinite(distanceMeters)) return 0;
  if (distanceMeters > MANEUVER_APPROACH_METERS) return 0;
  if (distanceMeters <= MANEUVER_IMMINENT_METERS) return 1;
  const span = MANEUVER_APPROACH_METERS - MANEUVER_IMMINENT_METERS;
  return Math.max(
    0.42,
    Math.min(1, (MANEUVER_APPROACH_METERS - distanceMeters) / span),
  );
}

export function sliceManeuverHighlight(
  route: [number, number][],
  routeMeters: number,
  cueMeters: number,
  distanceToNext: number,
): [number, number][] {
  if (route.length < 2 || !Number.isFinite(cueMeters)) return [];
  const start = Math.max(0, routeMeters);
  const after = MANEUVER_AFTER_TURN_METERS;
  const end = Math.max(start + 18, cueMeters + after);
  const ahead = Math.min(180, Math.max(28, end - start, distanceToNext + after));
  return sliceRouteAhead(route, start, ahead);
}
