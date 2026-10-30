import assert from "node:assert/strict";
import { destinationPoint } from "../geo";
import { createRouteProgressModel } from "../route-progress";
import { routeSnapLimitMeters, snapVehicleToRoute } from "../route-snap";
import type { VehiclePose } from "@/types/domain";

function northRoute() {
  const start = { lng: 120.2, lat: 23.0 };
  const end = destinationPoint(start, 400, 0);
  const model = createRouteProgressModel(
    [
      [start.lng, start.lat],
      [end.lng, end.lat],
    ],
    [],
  );
  assert.ok(model);
  return { start, model };
}

function pose(partial: Partial<VehiclePose> & Pick<VehiclePose, "lng" | "lat">): VehiclePose {
  return {
    heading: 0,
    source: "gps",
    accuracy: 8,
    speedMps: 0,
    ...partial,
  };
}

function testLimitStaysInsideTheBand() {
  assert.equal(routeSnapLimitMeters(8, false), 25);
  assert.equal(routeSnapLimitMeters(28, false), 28);
  assert.equal(routeSnapLimitMeters(80, false), 30);
  assert.ok(routeSnapLimitMeters(25, true) > routeSnapLimitMeters(25, false));
}

function testNearFixSitsOnTheRoute() {
  const { start, model } = northRoute();
  const offset = destinationPoint(start, 18, 90);
  const snapped = snapVehicleToRoute({
    raw: pose(offset),
    model,
    previousRouteMeters: 0,
  });
  assert.equal(snapped.snapped, true);
  assert.ok(Math.abs(snapped.lng - start.lng) < Math.abs(offset.lng - start.lng));
  assert.ok(Math.abs(snapped.heading) < 1);
}

function testFarFixStaysRaw() {
  const { start, model } = northRoute();
  const offset = destinationPoint(start, 48, 90);
  const snapped = snapVehicleToRoute({
    raw: pose({ ...offset, heading: 90 }),
    model,
    previousRouteMeters: 0,
  });
  assert.equal(snapped.snapped, false);
  assert.equal(snapped.lng, offset.lng);
  assert.equal(snapped.heading, 90);
}

testLimitStaysInsideTheBand();
testNearFixSitsOnTheRoute();
testFarFixStaysRaw();
console.log(JSON.stringify({ ok: true, suite: "route-snap", tests: 3 }));
