import assert from "node:assert/strict";
import { followMapBearing } from "../heading-cone";

function testNorthUpIsZeroWhenIdle() {
  assert.equal(
    followMapBearing(
      "north-up",
      { heading: 120, headingAvailable: true, speedMps: 12 },
      45,
      false,
    ),
    0,
  );
}

function testNavigateUsesRouteHeadingNotCompass() {
  assert.equal(
    followMapBearing(
      "heading-up",
      { heading: 210, headingAvailable: false, speedMps: 0 },
      12,
      true,
    ),
    210,
  );
}

function testNavigateIgnoresNorthUp() {
  assert.equal(
    followMapBearing(
      "north-up",
      { heading: 12, headingAvailable: true, speedMps: 8 },
      90,
      true,
      184,
    ),
    184,
  );
}

function testNavigatePrefersRouteBearing() {
  assert.equal(
    followMapBearing(
      "heading-up",
      { heading: 12, headingAvailable: true, speedMps: 8 },
      90,
      true,
      184,
    ),
    184,
  );
}

function testIdleUsesCompassWhenStill() {
  assert.equal(
    followMapBearing(
      "heading-up",
      { heading: 210, headingAvailable: false, speedMps: 0 },
      12,
      false,
    ),
    12,
  );
}

testNorthUpIsZeroWhenIdle();
testNavigateUsesRouteHeadingNotCompass();
testNavigateIgnoresNorthUp();
testNavigatePrefersRouteBearing();
testIdleUsesCompassWhenStill();
console.log(JSON.stringify({ ok: true, suite: "follow-bearing", tests: 5 }));
