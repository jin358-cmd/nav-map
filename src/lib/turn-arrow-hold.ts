import { headingDelta } from "@/lib/geo";

export type TurnArrowSide = "left" | "right";

export type TurnArrowHold = {
  latched: boolean;
  stepId: string | null;
  side: TurnArrowSide | null;
  apexMeters: number | null;
  exitBearing: number | null;
  alignedSinceMeters: number | null;
  passedApexAtMs: number | null;
  offRouteSinceMs: number | null;
};

/** Into the new road before the arrow may hide. */
export const TURN_ARROW_SETTLE_METERS = 8;
/** Heading must stay inside this window. Wide enough that one GPS twitch does not count. */
export const TURN_ARROW_ALIGN_DEG = 25;
/** Alignment has to hold across this much travel, so a single in-window sample is ignored. */
export const TURN_ARROW_ALIGN_HOLD_METERS = 4;
/** Past the apex with no settle: drop the arrow anyway. */
export const TURN_ARROW_FALLBACK_METERS = 42;
export const TURN_ARROW_OFF_ROUTE_METERS = 28;
export const TURN_ARROW_FALLBACK_MS = 9_000;
export const TURN_ARROW_APPROACH_METERS = 110;

export function emptyTurnArrowHold(): TurnArrowHold {
  return {
    latched: false,
    stepId: null,
    side: null,
    apexMeters: null,
    exitBearing: null,
    alignedSinceMeters: null,
    passedApexAtMs: null,
    offRouteSinceMs: null,
  };
}

export type TurnArrowHoldInput = {
  previous: TurnArrowHold;
  nowMs: number;
  navigating: boolean;
  offRoute: boolean;
  isTurn: boolean;
  stepId: string | null;
  side: TurnArrowSide | null;
  routeMeters: number;
  distanceToApex: number;
  exitBearing: number | null;
  heading: number;
};

export type TurnArrowHoldResult = {
  hold: TurnArrowHold;
  visible: boolean;
  reason:
    | "hidden"
    | "approaching"
    | "in-turn"
    | "settled"
    | "fallback-distance"
    | "fallback-time"
    | "off-route";
};

function latchFrom(input: TurnArrowHoldInput): TurnArrowHold {
  const apex =
    Number.isFinite(input.distanceToApex) && input.distanceToApex >= 0
      ? input.routeMeters + input.distanceToApex
      : input.routeMeters;
  return {
    latched: true,
    stepId: input.stepId,
    side: input.side,
    apexMeters: apex,
    exitBearing: input.exitBearing,
    alignedSinceMeters: null,
    passedApexAtMs: null,
    offRouteSinceMs: null,
  };
}

/**
 * The turn arrow stays up after the maneuver step flips.
 * It hides only once the car is several meters onto the new road
 * and the heading has stayed aligned, or a fallback trips.
 */
export function stepTurnArrowHold(input: TurnArrowHoldInput): TurnArrowHoldResult {
  if (!input.navigating) {
    return { hold: emptyTurnArrowHold(), visible: false, reason: "hidden" };
  }

  const approaching =
    input.isTurn &&
    Number.isFinite(input.distanceToApex) &&
    input.distanceToApex >= 0 &&
    input.distanceToApex <= TURN_ARROW_APPROACH_METERS;

  let hold = input.previous;
  if (!hold.latched) {
    if (!approaching) {
      return { hold, visible: false, reason: "hidden" };
    }
    hold = latchFrom(input);
    return { hold, visible: true, reason: "approaching" };
  }

  if (
    approaching &&
    input.stepId &&
    hold.stepId &&
    input.stepId !== hold.stepId &&
    input.distanceToApex > TURN_ARROW_SETTLE_METERS
  ) {
    hold = latchFrom(input);
  } else if (approaching && hold.apexMeters == null) {
    hold = latchFrom(input);
  }

  const apex = hold.apexMeters ?? input.routeMeters;
  const into = input.routeMeters - apex;
  const exitBearing = hold.exitBearing ?? input.exitBearing;
  const next: TurnArrowHold = {
    ...hold,
    side: hold.side ?? input.side,
    exitBearing,
    offRouteSinceMs: input.offRoute
      ? (hold.offRouteSinceMs ?? input.nowMs)
      : null,
    passedApexAtMs:
      into > 0 ? (hold.passedApexAtMs ?? input.nowMs) : hold.passedApexAtMs,
  };

  if (into <= 0) {
    next.alignedSinceMeters = null;
    return { hold: next, visible: true, reason: "approaching" };
  }

  const delta =
    exitBearing == null ? 180 : headingDelta(input.heading, exitBearing);
  if (delta <= TURN_ARROW_ALIGN_DEG) {
    next.alignedSinceMeters = hold.alignedSinceMeters ?? input.routeMeters;
  } else {
    next.alignedSinceMeters = null;
  }
  const alignedRun =
    next.alignedSinceMeters == null
      ? 0
      : input.routeMeters - next.alignedSinceMeters;

  if (
    input.offRoute &&
    (into >= TURN_ARROW_OFF_ROUTE_METERS ||
      (next.offRouteSinceMs != null &&
        input.nowMs - next.offRouteSinceMs >= TURN_ARROW_FALLBACK_MS))
  ) {
    return { hold: emptyTurnArrowHold(), visible: false, reason: "off-route" };
  }

  if (
    next.passedApexAtMs != null &&
    input.nowMs - next.passedApexAtMs >= TURN_ARROW_FALLBACK_MS
  ) {
    return {
      hold: emptyTurnArrowHold(),
      visible: false,
      reason: "fallback-time",
    };
  }

  if (into >= TURN_ARROW_FALLBACK_METERS) {
    return {
      hold: emptyTurnArrowHold(),
      visible: false,
      reason: "fallback-distance",
    };
  }

  if (
    into >= TURN_ARROW_SETTLE_METERS &&
    delta <= TURN_ARROW_ALIGN_DEG &&
    alignedRun >= TURN_ARROW_ALIGN_HOLD_METERS
  ) {
    return { hold: emptyTurnArrowHold(), visible: false, reason: "settled" };
  }

  return { hold: next, visible: true, reason: "in-turn" };
}
