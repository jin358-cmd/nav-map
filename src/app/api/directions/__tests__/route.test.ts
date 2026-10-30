import assert from "node:assert/strict";
import { GET } from "../route";

const ORIGINAL_FETCH = globalThis.fetch;
const ORIGINAL_CAR = process.env.OSRM_CAR_URL;
const ORIGINAL_MOTO = process.env.OSRM_MOTORCYCLE_URL;

function restoreEnv() {
  if (ORIGINAL_CAR === undefined) delete process.env.OSRM_CAR_URL;
  else process.env.OSRM_CAR_URL = ORIGINAL_CAR;
  if (ORIGINAL_MOTO === undefined) delete process.env.OSRM_MOTORCYCLE_URL;
  else process.env.OSRM_MOTORCYCLE_URL = ORIGINAL_MOTO;
  globalThis.fetch = ORIGINAL_FETCH;
}

function request(query: string) {
  return new Request(`http://navpilot.local/api/directions?${query}`);
}

const COORDS =
  "fromLng=120.54&fromLat=23.71&toLng=120.42&toLat=23.74&label=%E9%AB%98%E9%90%B5%E9%9B%B2%E6%9E%97%E7%AB%99";

function okRoute() {
  return {
    code: "Ok",
    routes: [
      {
        distance: 12340,
        duration: 980,
        geometry: {
          coordinates: [
            [120.54, 23.71],
            [120.48, 23.72],
            [120.42, 23.74],
          ],
        },
        legs: [
          {
            steps: [
              {
                name: "武昌路",
                distance: 100,
                maneuver: { type: "depart", location: [120.54, 23.71] },
              },
              {
                name: "高鐵雲林站",
                distance: 0,
                maneuver: { type: "arrive", location: [120.42, 23.74] },
              },
            ],
          },
        ],
      },
    ],
  };
}

async function testRejectsIncompleteCoordinates() {
  delete process.env.OSRM_MOTORCYCLE_URL;
  const response = await GET(request("fromLng=120&fromLat=nope&toLng=120&toLat=23&mode=motorcycle"));
  assert.equal(response.status, 400);
  const body = (await response.json()) as { error?: string };
  assert.match(body.error ?? "", /座標/);
}

async function testMotorcycleWithoutEnvIsNotConfigured() {
  delete process.env.OSRM_MOTORCYCLE_URL;
  let called = false;
  globalThis.fetch = async () => {
    called = true;
    throw new Error("should not fetch");
  };
  const response = await GET(request(`${COORDS}&mode=motorcycle`));
  assert.equal(response.status, 501);
  const body = (await response.json()) as { code?: string; error?: string; travelMode?: string };
  assert.equal(body.code, "NOT_CONFIGURED");
  assert.equal(body.travelMode, "motorcycle");
  assert.match(body.error ?? "", /NOT CONFIGURED/);
  assert.equal(called, false);
}

async function testMotorcycleProxiesToConfiguredOsrm() {
  process.env.OSRM_MOTORCYCLE_URL = "http://127.0.0.1:5001/route/v1/driving";
  const seen: string[] = [];
  globalThis.fetch = async (input) => {
    seen.push(String(input));
    return new Response(JSON.stringify(okRoute()), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  };
  const response = await GET(request(`${COORDS}&mode=motorcycle`));
  assert.equal(response.status, 200);
  const body = (await response.json()) as {
    travelMode?: string;
    distanceMeters?: number;
    durationSeconds?: number;
    coordinates?: number[][];
  };
  assert.equal(body.travelMode, "motorcycle");
  assert.equal(body.distanceMeters, 12340);
  assert.equal(body.durationSeconds, 980);
  assert.equal(body.coordinates?.length, 3);
  assert.equal(seen.length, 1);
  assert.match(seen[0], /^http:\/\/127\.0\.0\.1:5001\/route\/v1\/driving\/120\.54,23\.71;120\.42,23\.74/);
  assert.doesNotMatch(seen[0], /valhalla|project-osrm/i);
}

async function testCarUsesCarUrlNotMotorcycle() {
  process.env.OSRM_CAR_URL = "http://127.0.0.1:5000/route/v1/driving";
  process.env.OSRM_MOTORCYCLE_URL = "http://127.0.0.1:5001/route/v1/driving";
  const seen: string[] = [];
  globalThis.fetch = async (input) => {
    seen.push(String(input));
    return new Response(JSON.stringify(okRoute()), { status: 200 });
  };
  const response = await GET(request(`${COORDS}&mode=car`));
  assert.equal(response.status, 200);
  const body = (await response.json()) as { travelMode?: string };
  assert.equal(body.travelMode, "car");
  assert.match(seen[0], /^http:\/\/127\.0\.0\.1:5000\/route\/v1\/driving\//);
}

async function testMissingModeDefaultsToCar() {
  process.env.OSRM_CAR_URL = "http://127.0.0.1:5000/route/v1/driving";
  const seen: string[] = [];
  globalThis.fetch = async (input) => {
    seen.push(String(input));
    return new Response(JSON.stringify(okRoute()), { status: 200 });
  };
  const response = await GET(request(COORDS));
  assert.equal(response.status, 200);
  const body = (await response.json()) as { travelMode?: string };
  assert.equal(body.travelMode, "car");
  assert.match(seen[0], /127\.0\.0\.1:5000/);
}

async function testNoRouteIs404() {
  process.env.OSRM_MOTORCYCLE_URL = "http://127.0.0.1:5001/route/v1/driving";
  globalThis.fetch = async () =>
    new Response(JSON.stringify({ code: "NoRoute", routes: [] }), { status: 200 });
  const response = await GET(request(`${COORDS}&mode=motorcycle`));
  assert.equal(response.status, 404);
  const body = (await response.json()) as { travelMode?: string };
  assert.equal(body.travelMode, "motorcycle");
}

async function main() {
  const tests = [
    testRejectsIncompleteCoordinates,
    testMotorcycleWithoutEnvIsNotConfigured,
    testMotorcycleProxiesToConfiguredOsrm,
    testCarUsesCarUrlNotMotorcycle,
    testMissingModeDefaultsToCar,
    testNoRouteIs404,
  ];
  try {
    for (const test of tests) {
      restoreEnv();
      await test();
    }
  } finally {
    restoreEnv();
  }
  console.log(JSON.stringify({ ok: true, suite: "directions-route", tests: tests.length }));
}

main().catch((error) => {
  restoreEnv();
  console.error(error);
  process.exit(1);
});
