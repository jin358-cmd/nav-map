import assert from "node:assert/strict";
import {
  deriveGeometryTurn,
  guidanceArrowsAlong,
  lineLengthMeters,
  planNavGuidance,
  sliceRouteAhead,
  turnMarqueeArrows,
} from "../upcoming-route";
import { isTurnManeuver } from "../maneuver-guidance";

function northLine(): [number, number][] {
  const origin: [number, number] = [120.2028, 22.9908];
  const line: [number, number][] = [origin];
  for (let i = 1; i <= 12; i += 1) {
    line.push([origin[0], origin[1] + i * 0.0008]);
  }
  return line;
}

function testSliceAheadHasLength() {
  const line = sliceRouteAhead(northLine(), 20, 180);
  assert.ok(line.length >= 2);
  assert.ok(lineLengthMeters(line) > 50);
}

function testCruiseChevronsHaveBearing() {
  const line = sliceRouteAhead(northLine(), 8, 220);
  const arrows = guidanceArrowsAlong(line, 16, 0, 1);
  assert.ok(arrows.length >= 4, `expected several chevrons, got ${arrows.length}`);
  for (const arrow of arrows) {
    assert.ok(Number.isFinite(arrow.bearing));
    assert.ok(arrow.opacity > 0);
    assert.ok(arrow.scale > 0);
    assert.ok(Math.abs(((arrow.bearing + 180) % 360) - 180) < 25);
  }
}

function testTurnMarqueeStaysOnLine() {
  const line = sliceRouteAhead(northLine(), 0, 160);
  const arrows = turnMarqueeArrows(line, 0.2, 80);
  assert.ok(arrows.length >= 3);
  const minLat = Math.min(...line.map((point) => point[1]));
  const maxLat = Math.max(...line.map((point) => point[1]));
  for (const arrow of arrows) {
    assert.ok(arrow.lat >= minLat - 1e-6 && arrow.lat <= maxLat + 1e-6);
    assert.ok(arrow.opacity >= 0.9);
  }
}

testSliceAheadHasLength();
testCruiseChevronsHaveBearing();
testTurnMarqueeStaysOnLine();

function elbowRoute(): [number, number][] {
  const origin: [number, number] = [120.2, 23.0];
  const line: [number, number][] = [];
  for (let i = 0; i <= 3; i += 1) {
    line.push([origin[0], origin[1] + i * 0.0004]);
  }
  const last = line[line.length - 1];
  for (let i = 1; i <= 4; i += 1) {
    line.push([last[0] + i * 0.0004, last[1]]);
  }
  return line;
}

function testGeometryTurnFallback() {
  const straight = deriveGeometryTurn(northLine(), 0, 180);
  assert.equal(straight.isTurn, false);
  const elbow = deriveGeometryTurn(elbowRoute(), 0, 250);
  assert.equal(elbow.isTurn, true);
  assert.ok(Math.abs(elbow.signed) >= 20);
}

function testGuidanceNotGatedOnOsrmTurn() {
  const continueStep = {
    type: "continue",
    modifier: "straight",
    action: "直行",
  } as Parameters<typeof isTurnManeuver>[0];
  assert.equal(isTurnManeuver(continueStep), false);
  const cruise = planNavGuidance({
    navigating: true,
    routeLength: 40,
    distanceToNext: 320,
    isTurnStep: false,
    geometryTurn: false,
  });
  assert.equal(cruise.showGuidanceLine, true);
  assert.equal(cruise.showChevrons, true);
  const near = planNavGuidance({
    navigating: true,
    routeLength: 40,
    distanceToNext: 140,
    isTurnStep: false,
    geometryTurn: false,
  });
  assert.equal(near.showChevrons, true);
  const geometry = planNavGuidance({
    navigating: true,
    routeLength: 40,
    distanceToNext: 180,
    isTurnStep: false,
    geometryTurn: true,
  });
  assert.equal(geometry.showTurnBow, true);
  const idle = planNavGuidance({
    navigating: false,
    routeLength: 40,
    distanceToNext: 80,
    isTurnStep: true,
    geometryTurn: true,
  });
  assert.equal(idle.showGuidanceLine, false);
}

testGeometryTurnFallback();
testGuidanceNotGatedOnOsrmTurn();
console.log(JSON.stringify({ ok: true, suite: "guidance-chevrons", tests: 5 }));
