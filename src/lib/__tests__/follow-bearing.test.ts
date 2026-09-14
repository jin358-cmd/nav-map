import assert from "node:assert/strict";
import { followMapBearing } from "../heading-cone";

function testNorthUpIsZero() {
  assert.equal(
    followMapBearing(
      "north-up",
      { heading: 120, headingAvailable: true, speedMps: 12 },
      45,
      true,
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

testNorthUpIsZero();
testNavigateUsesRouteHeadingNotCompass();
testIdleUsesCompassWhenStill();
console.log(JSON.stringify({ ok: true, suite: "follow-bearing", tests: 3 }));
