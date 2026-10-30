import assert from "node:assert/strict";
import raw from "../elevated-ground/jianguo-fixture.json";
import { roadRibbonsFromProperties } from "../elevated-ground/bridges";
import {
  detectElevatedGroundFork,
  elevatedCenterlines,
  pickForkVias,
} from "../elevated-ground/fork";
import { distanceMeters, distanceToLines, metersAlongRoute } from "../elevated-ground/geometry";
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

function testJianguoForkFromEitherOrder() {
  const forward = detectElevatedGroundFork(elevated, ground, ribbons);
  const reverse = detectElevatedGroundFork(ground, elevated, ribbons);
  assert.ok(forward, "建國高架與平面應分成一組");
  assert.ok(reverse);
  assert.equal(forward.elevated, elevated);
  assert.equal(forward.ground, ground);
  assert.equal(reverse.elevated, elevated);
  assert.equal(reverse.ground, ground);
  assert.equal(forward.id, reverse.id);
  const bridges = elevatedCenterlines(ribbons);
  const decisionMeters = metersAlongRoute(elevated.coordinates, forward.decision);
  assert.ok(decisionMeters != null && decisionMeters > 80);
  const along = metersAlongRoute(elevated.coordinates, forward.elevated.coordinates[8]);
  assert.ok(along != null);
  assert.ok(distanceToLines(forward.decision, bridges) > 8);
  assert.ok(forward.rejoin);
}

function testMissingBridgeOrIdenticalRouteIsSilent() {
  assert.equal(detectElevatedGroundFork(elevated, ground, []), null);
  assert.equal(detectElevatedGroundFork(elevated, elevated, ribbons), null);
  const shifted: ForkRoute = {
    ...ground,
    coordinates: ground.coordinates.map(([lng, lat]) => [lng + 0.02, lat]),
  };
  assert.equal(detectElevatedGroundFork(elevated, shifted, ribbons), null);
}

function testViaPointsSitOnBridgeAndSurface() {
  const vias = pickForkVias(elevated.coordinates, ribbons, 0);
  assert.ok(vias);
  const bridges = elevatedCenterlines(ribbons);
  assert.ok(distanceToLines(vias.elevated, bridges) < 8);
  const gap = distanceMeters(vias.ground, vias.elevated);
  assert.ok(gap >= 12 && gap <= 55);
  assert.ok(distanceToLines(vias.ground, bridges) > 8);
}

function testRibbonParser() {
  const bridge = roadRibbonsFromProperties(
    { class: "trunk", brunnel: "bridge", layer: 1, ramp: 1 },
    { type: "LineString", coordinates: [[121.5, 25.05], [121.5, 25.04]] },
  );
  assert.equal(bridge.length, 1);
  assert.equal(bridge[0].elevated, true);
  assert.equal(bridge[0].link, true);
  const surface = roadRibbonsFromProperties(
    { class: "tertiary", layer: 0 },
    { type: "LineString", coordinates: [[121.5, 25.05], [121.5, 25.04]] },
  );
  assert.equal(surface[0].elevated, false);
  assert.equal(surface[0].link, false);
  const tunnel = roadRibbonsFromProperties(
    { class: "primary", brunnel: "tunnel", layer: -1 },
    { type: "LineString", coordinates: [[121.5, 25.05], [121.5, 25.04]] },
  );
  assert.equal(tunnel[0].elevated, false);
  const path = roadRibbonsFromProperties(
    { class: "path", brunnel: "bridge", layer: 1 },
    { type: "LineString", coordinates: [[121.5, 25.05], [121.5, 25.04]] },
  );
  assert.equal(path.length, 0);
  const linkName = roadRibbonsFromProperties(
    { class: "primary", highway: "primary_link" },
    { type: "LineString", coordinates: [[121.5, 25.05], [121.5, 25.04]] },
  );
  assert.equal(linkName[0].link, true);
  assert.equal(linkName[0].elevated, false);
}

testJianguoForkFromEitherOrder();
testMissingBridgeOrIdenticalRouteIsSilent();
testViaPointsSitOnBridgeAndSurface();
testRibbonParser();
console.log(JSON.stringify({ ok: true, suite: "elevated-ground-fork", tests: 4 }));
