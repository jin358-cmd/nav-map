import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
import {
  emptyNavAutoZoomState,
  NAV_AUTO_ZOOM_DEFAULTS,
  simulateYunlinAlleyZoom,
  stepNavAutoZoom,
  triggerDistanceMeters,
  type NavAutoZoomInput,
  type NavAutoZoomState,
} from "../nav-auto-zoom";

const BASE = 16.7;
const FOCUS = 18.2;

function drive(partial: Partial<NavAutoZoomInput> & Pick<NavAutoZoomInput, "previous" | "nowMs" | "routeMeters">): NavAutoZoomInput {
  return {
    enabled: true,
    navigating: true,
    held: false,
    heldZoom: partial.previous.zoom || BASE,
    recenter: false,
    speedMps: 4,
    turnCues: [200],
    baseZoom: BASE,
    focusZoom: FOCUS,
    ...partial,
  };
}

function testSpeedAwareTrigger() {
  const slow = triggerDistanceMeters(2);
  const fast = triggerDistanceMeters(16);
  assert.ok(slow >= 100 && slow <= 160, `slow trigger ${slow}`);
  assert.ok(fast > slow);
  assert.ok(fast <= 200, `fast trigger ${fast}`);
  assert.ok(fast - slow >= 40);
}

function testApproachingThenCompleted() {
  let state = emptyNavAutoZoomState(BASE);
  const far = stepNavAutoZoom(drive({ previous: state, nowMs: 0, routeMeters: 20, speedMps: 4 }));
  assert.equal(far.phase, "cruise");
  assert.ok(Math.abs(far.zoom - BASE) < 0.05);
  state = far.state;

  const trigger = triggerDistanceMeters(4);
  const enterAt = 200 - trigger + 5;
  const entered = stepNavAutoZoom(
    drive({ previous: state, nowMs: 1_000, routeMeters: enterAt, speedMps: 4 }),
  );
  assert.equal(entered.phase, "approach");
  assert.ok(entered.zoom >= BASE);
  state = entered.state;

  const zoomed = stepNavAutoZoom(
    drive({
      previous: state,
      nowMs: 1_000 + NAV_AUTO_ZOOM_DEFAULTS.zoomInMs,
      routeMeters: enterAt + 10,
      speedMps: 4,
    }),
  );
  assert.ok(zoomed.zoom > BASE + 1, `expected zoom-in, got ${zoomed.zoom}`);
  state = zoomed.state;

  const atCorner = stepNavAutoZoom(
    drive({ previous: state, nowMs: 4_000, routeMeters: 200, speedMps: 4 }),
  );
  assert.ok(atCorner.zoom > FOCUS - 0.15, `zoom dropped at the corner: ${atCorner.zoom}`);
  assert.notEqual(atCorner.phase, "cruise");
  state = atCorner.state;

  const justPast = stepNavAutoZoom(
    drive({ previous: state, nowMs: 5_000, routeMeters: 208, speedMps: 4, turnCues: [200] }),
  );
  assert.notEqual(justPast.phase, "recover");
  assert.ok(justPast.zoom > FOCUS - 0.2);
  state = justPast.state;

  const done = stepNavAutoZoom(
    drive({
      previous: state,
      nowMs: 8_000,
      routeMeters: 200 + NAV_AUTO_ZOOM_DEFAULTS.settleMeters + 2,
      speedMps: 4,
      turnCues: [200],
    }),
  );
  assert.equal(done.phase, "recover");
  const back = stepNavAutoZoom(
    drive({
      previous: done.state,
      nowMs: 8_000 + NAV_AUTO_ZOOM_DEFAULTS.zoomOutMs,
      routeMeters: 260,
      speedMps: 4,
      turnCues: [200],
    }),
  );
  assert.ok(back.zoom < BASE + 0.35, `did not ease back, zoom ${back.zoom}`);
  assert.equal(back.phase, "cruise");
}

function testConsecutiveTurnsStayZoomed() {
  const cues = [200, 250];
  let state = emptyNavAutoZoomState(BASE);
  const entered = stepNavAutoZoom(
    drive({ previous: state, nowMs: 0, routeMeters: 70, speedMps: 3, turnCues: cues }),
  );
  assert.equal(entered.phase, "approach");
  state = entered.state;
  const tight = stepNavAutoZoom(
    drive({
      previous: state,
      nowMs: NAV_AUTO_ZOOM_DEFAULTS.zoomInMs,
      routeMeters: 90,
      speedMps: 3,
      turnCues: cues,
    }),
  );
  assert.ok(tight.zoom >= FOCUS, `alley zoom ${tight.zoom} should exceed the normal focus`);
  state = tight.state;

  let lowest = tight.zoom;
  for (let meters = 190; meters <= 270; meters += 5) {
    const frame = stepNavAutoZoom(
      drive({
        previous: state,
        nowMs: 2_000 + meters * 40,
        routeMeters: meters,
        speedMps: 3,
        turnCues: cues,
      }),
    );
    state = frame.state;
    lowest = Math.min(lowest, frame.zoom);
  }
  assert.ok(lowest > FOCUS - 0.05, `zoomed out between close turns, low ${lowest}`);
  assert.notEqual(state.phase, "cruise");
}

function testMinimumIntervalBlocksBounce() {
  let state = emptyNavAutoZoomState(BASE);
  const entered = stepNavAutoZoom(
    drive({ previous: state, nowMs: 0, routeMeters: 70, speedMps: 4 }),
  );
  assert.equal(entered.phase, "approach");
  state = entered.state;
  const bounced = stepNavAutoZoom(
    drive({
      previous: state,
      nowMs: 250,
      routeMeters: 10,
      speedMps: 4,
      turnCues: [400],
    }),
  );
  assert.notEqual(bounced.phase, "recover");
  assert.equal(bounced.state.lastChangeMs, entered.state.lastChangeMs);
  const later = stepNavAutoZoom(
    drive({
      previous: bounced.state,
      nowMs: NAV_AUTO_ZOOM_DEFAULTS.minIntervalMs + 20,
      routeMeters: 10,
      speedMps: 4,
      turnCues: [400],
    }),
  );
  assert.equal(later.phase, "recover");
}

function testGestureHoldsZoom() {
  let state: NavAutoZoomState = emptyNavAutoZoomState(BASE);
  const entered = stepNavAutoZoom(
    drive({ previous: state, nowMs: 0, routeMeters: 60, speedMps: 4 }),
  );
  state = entered.state;
  const held = stepNavAutoZoom(
    drive({
      previous: state,
      nowMs: 500,
      routeMeters: 40,
      held: true,
      heldZoom: 15.2,
      speedMps: 4,
    }),
  );
  assert.equal(held.zoom, 15.2);
  const still = stepNavAutoZoom(
    drive({
      previous: held.state,
      nowMs: 800,
      routeMeters: 30,
      held: false,
      heldZoom: 15.2,
      speedMps: 4,
    }),
  );
  assert.equal(still.zoom, 15.2);
  const resumed = stepNavAutoZoom(
    drive({
      previous: still.state,
      nowMs: 800 + NAV_AUTO_ZOOM_DEFAULTS.gestureResumeMs + 10,
      routeMeters: 30,
      held: false,
      recenter: true,
      speedMps: 4,
    }),
  );
  assert.notEqual(resumed.zoom, 15.2);
  assert.equal(resumed.phase, "approach");
}

function testYunlinResidentialDrive() {
  const samples = simulateYunlinAlleyZoom();
  const at = (meters: number) => samples.find((sample) => sample.routeMeters === meters);
  const before = at(20);
  const intoFirst = at(140);
  const betweenTight = at(250);
  const afterCluster = at(380);
  const late = at(400);
  assert.ok(before && intoFirst && betweenTight && afterCluster && late);
  assert.ok(before.zoom < 17, `cruise zoom ${before.zoom}`);
  assert.ok(intoFirst.zoom > before.zoom + 0.4, `no zoom-in before the alley, ${intoFirst.zoom}`);
  assert.ok(betweenTight.zoom >= FOCUS - 0.2, `dropped between 巷弄 turns ${betweenTight.zoom}`);
  assert.ok(afterCluster.zoom < betweenTight.zoom - 0.3, `still tight after the alleys ${afterCluster.zoom}`);
  assert.ok(late.zoom < 17.2, `did not return to cruise, ${late.zoom} ${late.phase}`);

  const lines = ["routeM,zoom,phase,distanceToTurn,trigger"];
  for (const sample of samples) {
    if (sample.routeMeters % 20 !== 0) continue;
    lines.push(
      `${sample.routeMeters},${sample.zoom},${sample.phase},${Math.round(sample.distanceToTurn)},${sample.triggerMeters}`,
    );
  }
  const csv = lines.join("\n");
  console.log(csv);
  try {
    writeFileSync("/opt/cursor/artifacts/yunlin-auto-zoom.csv", `${csv}\n`);
  } catch {
    /* artifact dir is optional outside the agent */
  }
}

testSpeedAwareTrigger();
testApproachingThenCompleted();
testConsecutiveTurnsStayZoomed();
testMinimumIntervalBlocksBounce();
testGestureHoldsZoom();
testYunlinResidentialDrive();
console.log(JSON.stringify({ ok: true, suite: "nav-auto-zoom", tests: 6 }));
