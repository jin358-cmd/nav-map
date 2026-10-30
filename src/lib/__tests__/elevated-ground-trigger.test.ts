import assert from "node:assert/strict";
import raw from "../elevated-ground/jianguo-fixture.json";
import { elevatedGroundChoiceEnabled } from "../elevated-ground/flag";
import { detectElevatedGroundFork } from "../elevated-ground/fork";
import { metersAlongRoute } from "../elevated-ground/geometry";
import {
  canProbeFork,
  forkTimedOut,
  initialForkPrompt,
  reduceForkPrompt,
  type ForkPromptInput,
  type ForkPromptState,
} from "../elevated-ground/trigger";
import { FORK_PROMPT_METERS } from "../elevated-ground/types";
import type { ForkRoute, LngLatPair, RoadRibbon } from "../elevated-ground/types";

const ribbons = raw.ribbons as RoadRibbon[];
const elevated: ForkRoute = {
  coordinates: raw.elevated.coordinates as LngLatPair[],
  distanceMeters: raw.elevated.distanceMeters,
  durationSeconds: raw.elevated.durationSeconds,
};
const ground: ForkRoute = {
  coordinates: raw.ground.coordinates as LngLatPair[],
  distanceMeters: raw.ground.distanceMeters,
  durationSeconds: raw.ground.durationSeconds,
};

function sample(aheadMeters: number, extra: Partial<ForkPromptInput> = {}): ForkPromptInput {
  return {
    navigating: true,
    offRoute: false,
    choiceMade: false,
    dismissed: false,
    aheadMeters,
    ...extra,
  };
}

function settle(aheadMeters: number, extra: Partial<ForkPromptInput> = {}): ForkPromptState {
  const pending = reduceForkPrompt(initialForkPrompt(), sample(aheadMeters, extra));
  return reduceForkPrompt(pending, sample(aheadMeters, extra));
}

function testEntryWindowIs200Meters() {
  assert.equal(FORK_PROMPT_METERS, 200);
  assert.equal(settle(201).visible, false);
  assert.equal(settle(200).visible, true);
  assert.equal(settle(50).visible, true);
  assert.equal(settle(0).visible, true);
  const once = reduceForkPrompt(initialForkPrompt(), sample(80));
  assert.equal(once.visible, false);
  assert.equal(once.pending, true);
  assert.equal(reduceForkPrompt(once, sample(80)).visible, true);
}

function testHiddenOutsideNavigation() {
  assert.equal(settle(40, { navigating: false }).visible, false);
  assert.equal(settle(40, { offRoute: true }).visible, false);
  assert.equal(settle(40, { choiceMade: true }).visible, false);
  assert.equal(settle(40, { dismissed: true }).visible, false);
  const showing = settle(40);
  assert.equal(reduceForkPrompt(showing, sample(40, { offRoute: true })).visible, false);
  assert.equal(reduceForkPrompt(showing, sample(-30)).visible, false);
}

function testJitterHysteresis() {
  const showing = settle(180);
  assert.equal(reduceForkPrompt(showing, sample(220)).visible, true);
  assert.equal(reduceForkPrompt(showing, sample(250)).visible, false);
  assert.equal(reduceForkPrompt(showing, sample(-10)).visible, true);
  assert.equal(reduceForkPrompt(showing, sample(-30)).visible, false);
  const spiked = reduceForkPrompt(initialForkPrompt(), sample(90));
  assert.equal(reduceForkPrompt(spiked, sample(400)).visible, false);
  assert.equal(reduceForkPrompt(spiked, sample(400)).pending, false);
}

function testDismissAndProbeBudget() {
  assert.equal(forkTimedOut(1_000, 12_999), false);
  assert.equal(forkTimedOut(1_000, 13_000), true);
  assert.equal(forkTimedOut(null, 13_000), false);
  const gate = { lastAtMs: 0, negatives: [] as { key: string; atMs: number; routeMeters: number }[] };
  assert.equal(canProbeFork(gate, 10_000, 0, "a"), true);
  gate.lastAtMs = 10_000;
  assert.equal(canProbeFork(gate, 20_000, 0, "a"), false);
  assert.equal(canProbeFork(gate, 30_000, 0, "a"), true);
  gate.lastAtMs = 0;
  gate.negatives.push({ key: "a", atMs: 30_000, routeMeters: 100 });
  assert.equal(canProbeFork(gate, 40_000, 200, "a"), false);
  assert.equal(canProbeFork(gate, 40_000, 500, "a"), true);
  assert.equal(canProbeFork(gate, 90_000, 100, "a"), true);
  assert.equal(canProbeFork(gate, 40_000, 100, "b"), true);
}

function testRealForkTriggerDistances() {
  const fork = detectElevatedGroundFork(elevated, ground, ribbons);
  assert.ok(fork);
  const decisionMeters = metersAlongRoute(elevated.coordinates, fork.decision);
  assert.ok(decisionMeters != null);
  assert.ok(decisionMeters > 250, `decision at ${decisionMeters}m leaves no room for a 200m approach`);
  const nearAhead = decisionMeters - Math.max(0, decisionMeters - 120);
  const farAhead = decisionMeters - Math.max(0, decisionMeters - 320);
  assert.ok(nearAhead <= 200 && nearAhead > 0);
  assert.ok(farAhead > 200);
  assert.equal(settle(nearAhead).visible, true);
  assert.equal(settle(farAhead).visible, false);
}

function testFlagDefaults() {
  assert.equal(elevatedGroundChoiceEnabled({ flag: "1", vercelEnv: "production" }), true);
  assert.equal(elevatedGroundChoiceEnabled({ flag: "0", vercelEnv: "preview" }), false);
  assert.equal(elevatedGroundChoiceEnabled({ flag: undefined, vercelEnv: "preview" }), true);
  assert.equal(elevatedGroundChoiceEnabled({ flag: undefined, vercelEnv: "production" }), false);
  assert.equal(elevatedGroundChoiceEnabled({ flag: undefined, vercelEnv: undefined }), true);
}

testEntryWindowIs200Meters();
testHiddenOutsideNavigation();
testJitterHysteresis();
testDismissAndProbeBudget();
testRealForkTriggerDistances();
testFlagDefaults();
console.log(JSON.stringify({ ok: true, suite: "elevated-ground-trigger", tests: 6 }));
