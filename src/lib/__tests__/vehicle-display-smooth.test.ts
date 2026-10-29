import assert from "node:assert/strict";
import { distanceKm } from "../geo";
import { createRouteProgressModel } from "../route-progress";
import {
  createVehicleDisplayState,
  stepVehicleDisplay,
} from "../vehicle-display";
import type { DisplayPose, VehiclePose } from "@/types/domain";

function northRoute() {
  const model = createRouteProgressModel(
    [
      [120.2, 23],
      [120.2, 23.004],
    ],
    [],
  );
  assert.ok(model);
  return model;
}

function pose(lat: number, routeMeters: number): DisplayPose {
  return {
    lng: 120.2,
    lat,
    heading: 0,
    routeMeters,
    snapConfidence: 1,
    snapped: true,
  };
}

function raw(speedMps: number): VehiclePose {
  return {
    lng: 120.2,
    lat: 23,
    heading: 0,
    speedMps,
    source: "gps",
    accuracy: 8,
  };
}

function testCoastsWhileGpsStaysPut() {
  const model = northRoute();
  let state = createVehicleDisplayState(pose(23, 0));
  const target = pose(23, 0);
  for (let frame = 0; frame < 20; frame += 1) {
    state = stepVehicleDisplay({
      current: state,
      target,
      raw: raw(10),
      model,
      navigating: true,
      dtSeconds: 0.05,
      elapsedSinceFixSeconds: (frame + 1) * 0.05,
    });
  }
  const moved = distanceKm({ lng: 120.2, lat: 23 }, state) * 1000;
  assert.ok(moved > 8 && moved < 14, `expected about 10m of coast, got ${moved}`);
  const steps: number[] = [];
  let previous = state;
  const jumped = pose(23.00009, 10);
  for (let frame = 0; frame < 10; frame += 1) {
    state = stepVehicleDisplay({
      current: state,
      target: jumped,
      raw: raw(10),
      model,
      navigating: true,
      dtSeconds: 0.05,
      elapsedSinceFixSeconds: frame * 0.05,
    });
    steps.push(distanceKm(previous, state) * 1000);
    previous = state;
  }
  const biggest = Math.max(...steps);
  assert.ok(biggest < 2.5, `frame step should stay smooth, got ${biggest}`);
}

function testStationaryFixDoesNotHop() {
  const model = northRoute();
  let state = createVehicleDisplayState(pose(23, 0));
  state = stepVehicleDisplay({
    current: state,
    target: pose(23.00002, 2),
    raw: raw(0),
    model,
    navigating: true,
    dtSeconds: 0.05,
    elapsedSinceFixSeconds: 1,
  });
  const moved = distanceKm({ lng: 120.2, lat: 23 }, state) * 1000;
  assert.ok(moved < 1, `parked GPS jitter should hold, got ${moved}`);
}

testCoastsWhileGpsStaysPut();
testStationaryFixDoesNotHop();
