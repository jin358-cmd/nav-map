import assert from "node:assert/strict";
import {
  buildOsrmRouteUrl,
  isPublicOsrmDemo,
  PUBLIC_OSRM_CAR_URL,
  resolveOsrmBaseUrl,
} from "../osrm-route";
import { directionsModeQuery, travelModeSwitch } from "../travel-mode";

function testCarFallsBackToPublicDemo() {
  const resolved = resolveOsrmBaseUrl("car", {});
  assert.equal(resolved.ok, true);
  if (resolved.ok) assert.equal(resolved.baseUrl, PUBLIC_OSRM_CAR_URL);
}

function testCarUsesConfiguredUrl() {
  const resolved = resolveOsrmBaseUrl("car", {
    OSRM_CAR_URL: "http://127.0.0.1:5000/route/v1/driving",
  });
  assert.equal(resolved.ok, true);
  if (resolved.ok) {
    assert.equal(resolved.baseUrl, "http://127.0.0.1:5000/route/v1/driving");
  }
}

function testCarRejectsBadUrl() {
  const resolved = resolveOsrmBaseUrl("car", { OSRM_CAR_URL: "not-a-url" });
  assert.equal(resolved.ok, false);
  if (!resolved.ok) {
    assert.equal(resolved.status, 500);
    assert.equal(resolved.code, "BAD_OSRM_URL");
  }
}

function testMotorcycleUnsetIsNotConfigured() {
  const resolved = resolveOsrmBaseUrl("motorcycle", {});
  assert.equal(resolved.ok, false);
  if (!resolved.ok) {
    assert.equal(resolved.status, 501);
    assert.equal(resolved.code, "NOT_CONFIGURED");
    assert.match(resolved.error, /NOT CONFIGURED/);
  }
}

function testMotorcycleRejectsPublicCarDemo() {
  assert.equal(isPublicOsrmDemo("https://router.project-osrm.org/route/v1/driving"), true);
  const resolved = resolveOsrmBaseUrl("motorcycle", {
    OSRM_MOTORCYCLE_URL: "https://router.project-osrm.org/route/v1/driving",
  });
  assert.equal(resolved.ok, false);
  if (!resolved.ok) assert.equal(resolved.code, "NOT_CONFIGURED");
}

function testMotorcycleUsesLocalRouter() {
  const resolved = resolveOsrmBaseUrl("motorcycle", {
    OSRM_MOTORCYCLE_URL: "http://127.0.0.1:5001/route/v1/driving",
  });
  assert.equal(resolved.ok, true);
  if (resolved.ok) {
    assert.equal(resolved.baseUrl, "http://127.0.0.1:5001/route/v1/driving");
  }
}

function testRouteUrlCarriesCoordinates() {
  const endpoint = buildOsrmRouteUrl(
    "http://127.0.0.1:5001/route/v1/driving",
    120.5402724,
    23.7117872,
    120.4163836,
    23.7365572,
  );
  assert.equal(endpoint.origin, "http://127.0.0.1:5001");
  assert.match(endpoint.pathname, /120\.5402724,23\.7117872;120\.4163836,23\.7365572$/);
  assert.equal(endpoint.searchParams.get("geometries"), "geojson");
  assert.equal(endpoint.searchParams.get("steps"), "true");
  assert.equal(endpoint.searchParams.get("overview"), "full");
  assert.equal(endpoint.searchParams.get("alternatives"), "false");
  assert.equal(endpoint.searchParams.get("radiuses"), null);
}

function testForkUrlUsesAlternativesOrVia() {
  const alternatives = buildOsrmRouteUrl(
    "https://router.project-osrm.org/route/v1/driving",
    121.53,
    25.06,
    121.54,
    25.03,
    { alternatives: true },
  );
  assert.equal(alternatives.searchParams.get("alternatives"), "true");
  assert.equal(alternatives.searchParams.get("radiuses"), null);
  const via = buildOsrmRouteUrl(
    "https://router.project-osrm.org/route/v1/driving",
    121.53,
    25.06,
    121.54,
    25.03,
    { via: [{ lng: 121.5368, lat: 25.05 }], viaRadiusMeters: 30 },
  );
  assert.match(via.pathname, /121\.53,25\.06;121\.5368,25\.05;121\.54,25\.03$/);
  assert.equal(via.searchParams.get("alternatives"), "false");
  assert.equal(via.searchParams.get("radiuses"), "unlimited;30;unlimited");
}

function testModeSwitchReplansOnlyWithDestination() {
  assert.deepEqual(travelModeSwitch("motorcycle", true), {
    mode: "motorcycle",
    replan: true,
  });
  assert.deepEqual(travelModeSwitch("car", false), {
    mode: "car",
    replan: false,
  });
  assert.equal(directionsModeQuery("motorcycle"), "motorcycle");
  assert.equal(directionsModeQuery("car"), "car");
}

testCarFallsBackToPublicDemo();
testCarUsesConfiguredUrl();
testCarRejectsBadUrl();
testMotorcycleUnsetIsNotConfigured();
testMotorcycleRejectsPublicCarDemo();
testMotorcycleUsesLocalRouter();
testRouteUrlCarriesCoordinates();
testForkUrlUsesAlternativesOrVia();
testModeSwitchReplansOnlyWithDestination();
console.log(JSON.stringify({ ok: true, suite: "osrm-routing", tests: 9 }));
