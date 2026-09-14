import assert from "node:assert/strict";
import {
  guidanceArrowsAlong,
  lineLengthMeters,
  sliceRouteAhead,
  turnMarqueeArrows,
} from "../upcoming-route";

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
    assert.ok(arrow.opacity > 0);
  }
}

testSliceAheadHasLength();
testCruiseChevronsHaveBearing();
testTurnMarqueeStaysOnLine();
console.log(JSON.stringify({ ok: true, suite: "guidance-chevrons", tests: 3 }));
