import assert from "node:assert/strict";
import {
  emptyTurnArrowHold,
  stepTurnArrowHold,
  TURN_ARROW_ALIGN_HOLD_METERS,
  TURN_ARROW_FALLBACK_METERS,
  TURN_ARROW_SETTLE_METERS,
  type TurnArrowHold,
  type TurnArrowHoldInput,
} from "../turn-arrow-hold";

function approach(
  side: "left" | "right",
  extras: Partial<TurnArrowHoldInput> = {},
): TurnArrowHoldInput {
  return {
    previous: emptyTurnArrowHold(),
    nowMs: 1_000,
    navigating: true,
    offRoute: false,
    isTurn: true,
    stepId: side === "right" ? "turn-right" : "turn-left",
    side,
    routeMeters: 100,
    distanceToApex: 24,
    exitBearing: side === "right" ? 90 : 270,
    heading: 0,
    ...extras,
  };
}

function continueHold(
  previous: TurnArrowHold,
  patch: Partial<TurnArrowHoldInput>,
): TurnArrowHoldInput {
  return {
    ...approach(previous.side ?? "right"),
    previous,
    isTurn: false,
    stepId: "after-turn",
    distanceToApex: 400,
    ...patch,
  };
}

function testRightTurnStaysUntilSettled() {
  const armed = stepTurnArrowHold(approach("right"));
  assert.equal(armed.visible, true);
  assert.equal(armed.reason, "approaching");
  assert.equal(armed.hold.side, "right");
  assert.equal(armed.hold.apexMeters, 124);

  const atApex = stepTurnArrowHold(
    continueHold(armed.hold, { routeMeters: 124, heading: 20, nowMs: 2_000 }),
  );
  assert.equal(atApex.visible, true, "arrow must stay as the turn starts");

  const early = stepTurnArrowHold(
    continueHold(atApex.hold, {
      routeMeters: 124 + 3,
      heading: 40,
      nowMs: 3_000,
    }),
  );
  assert.equal(early.visible, true, "3 m into the new road is too soon");

  const alignedButShort = stepTurnArrowHold(
    continueHold(early.hold, {
      routeMeters: 124 + TURN_ARROW_SETTLE_METERS,
      heading: 92,
      nowMs: 4_000,
    }),
  );
  assert.equal(
    alignedButShort.visible,
    true,
    "one aligned sample must not dismiss",
  );

  const settled = stepTurnArrowHold(
    continueHold(alignedButShort.hold, {
      routeMeters:
        124 + TURN_ARROW_SETTLE_METERS + TURN_ARROW_ALIGN_HOLD_METERS,
      heading: 91,
      nowMs: 5_000,
    }),
  );
  assert.equal(settled.visible, false);
  assert.equal(settled.reason, "settled");
}

function testLeftTurnMirrorsRight() {
  const armed = stepTurnArrowHold(approach("left", { heading: 0 }));
  assert.equal(armed.hold.side, "left");
  assert.equal(armed.hold.exitBearing, 270);

  let hold = armed.hold;
  const into = 124;
  const mid = stepTurnArrowHold(
    continueHold(hold, { routeMeters: into + 2, heading: 230, nowMs: 2_000 }),
  );
  assert.equal(mid.visible, true);
  hold = mid.hold;

  const mark = stepTurnArrowHold(
    continueHold(hold, {
      routeMeters: into + TURN_ARROW_SETTLE_METERS,
      heading: 268,
      nowMs: 3_000,
    }),
  );
  assert.equal(mark.visible, true);
  const done = stepTurnArrowHold(
    continueHold(mark.hold, {
      routeMeters:
        into + TURN_ARROW_SETTLE_METERS + TURN_ARROW_ALIGN_HOLD_METERS,
      heading: 272,
      nowMs: 4_000,
    }),
  );
  assert.equal(done.visible, false);
  assert.equal(done.reason, "settled");
}

function testHeadingJitterDoesNotDismiss() {
  const armed = stepTurnArrowHold(approach("right"));
  const apex = armed.hold.apexMeters ?? 0;
  let hold = armed.hold;

  const twitch = stepTurnArrowHold(
    continueHold(hold, {
      routeMeters: apex + 7,
      heading: 88,
      nowMs: 2_000,
    }),
  );
  assert.equal(twitch.visible, true);
  hold = twitch.hold;

  const swung = stepTurnArrowHold(
    continueHold(hold, {
      routeMeters: apex + 8,
      heading: 150,
      nowMs: 2_200,
    }),
  );
  assert.equal(swung.visible, true, "a swing back out of alignment keeps the arrow");
  assert.equal(swung.hold.alignedSinceMeters, null);

  const again = stepTurnArrowHold(
    continueHold(swung.hold, {
      routeMeters: apex + TURN_ARROW_SETTLE_METERS,
      heading: 90,
      nowMs: 2_400,
    }),
  );
  assert.equal(again.visible, true, "a fresh aligned sample after jitter is not enough");
}

function testFallbackDistanceAndOffRoute() {
  const armed = stepTurnArrowHold(approach("right"));
  const apex = armed.hold.apexMeters ?? 0;
  const wandered = stepTurnArrowHold(
    continueHold(armed.hold, {
      routeMeters: apex + TURN_ARROW_FALLBACK_METERS + 1,
      heading: 180,
      nowMs: 4_000,
    }),
  );
  assert.equal(wandered.visible, false);
  assert.equal(wandered.reason, "fallback-distance");

  const off = stepTurnArrowHold(
    continueHold(armed.hold, {
      routeMeters: apex + 30,
      heading: 40,
      offRoute: true,
      nowMs: 3_000,
    }),
  );
  assert.equal(off.visible, false);
  assert.equal(off.reason, "off-route");
}

testRightTurnStaysUntilSettled();
testLeftTurnMirrorsRight();
testHeadingJitterDoesNotDismiss();
testFallbackDistanceAndOffRoute();
console.log(JSON.stringify({ ok: true, suite: "turn-arrow-hold", tests: 4 }));
