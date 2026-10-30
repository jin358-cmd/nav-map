import assert from "node:assert/strict";
import { GET } from "../route";

const ORIGINAL_FETCH = globalThis.fetch;
const ORIGINAL_CAR = process.env.OSRM_CAR_URL;

function restore() {
  globalThis.fetch = ORIGINAL_FETCH;
  if (ORIGINAL_CAR === undefined) delete process.env.OSRM_CAR_URL;
  else process.env.OSRM_CAR_URL = ORIGINAL_CAR;
}

function request(query: string) {
  return new Request(`http://navpilot.local/api/directions/fork?${query}`);
}

const COORDS = "fromLng=121.5368&fromLat=25.0642&toLng=121.53715&toLat=25.0374&label=%E4%BB%81%E6%84%9B%E8%B7%AF";

function payload(distance: number) {
  return {
    code: "Ok",
    routes: [
      {
        distance,
        duration: 200,
        geometry: {
          coordinates: [
            [121.5368, 25.0642],
            [121.5368, 25.05],
            [121.53715, 25.0374],
          ],
        },
        legs: [
          {
            steps: [
              {
                name: "建國北路三段",
                distance: 100,
                maneuver: { type: "depart", location: [121.5368, 25.0642] },
              },
              {
                name: "仁愛路",
                distance: 0,
                maneuver: { type: "arrive", location: [121.53715, 25.0374] },
              },
            ],
          },
        ],
      },
    ],
  };
}

async function testAlternativesRequest() {
  process.env.OSRM_CAR_URL = "http://127.0.0.1:5000/route/v1/driving";
  let called = "";
  globalThis.fetch = async (input) => {
    called = String(input);
    return new Response(JSON.stringify(payload(3000)), { status: 200 });
  };
  const response = await GET(request(`${COORDS}&alternatives=1&mode=car`));
  assert.equal(response.status, 200);
  const body = (await response.json()) as { routes?: Array<{ distanceMeters: number }> };
  assert.equal(body.routes?.length, 1);
  assert.equal(body.routes?.[0]?.distanceMeters, 3000);
  const url = new URL(called);
  assert.equal(url.searchParams.get("alternatives"), "true");
  assert.equal(url.searchParams.get("radiuses"), null);
  assert.equal(url.searchParams.get("steps"), "true");
}

async function testViaRequestKeepsSingleRoute() {
  process.env.OSRM_CAR_URL = "http://127.0.0.1:5000/route/v1/driving";
  let called = "";
  globalThis.fetch = async (input) => {
    called = String(input);
    return new Response(JSON.stringify(payload(3045)), { status: 200 });
  };
  const response = await GET(request(`${COORDS}&viaLng=121.53647&viaLat=25.0472`));
  assert.equal(response.status, 200);
  const url = new URL(called);
  assert.match(url.pathname, /121\.53647,25\.0472/);
  assert.equal(url.searchParams.get("alternatives"), "false");
  assert.equal(url.searchParams.get("radiuses"), "unlimited;30;unlimited");
}

async function testRejectsBadCoordinates() {
  const response = await GET(request("fromLng=1&fromLat=nope&toLng=2&toLat=3"));
  assert.equal(response.status, 400);
}

async function run() {
  try {
    await testAlternativesRequest();
    await testViaRequestKeepsSingleRoute();
    await testRejectsBadCoordinates();
    console.log(JSON.stringify({ ok: true, suite: "directions-fork", tests: 3 }));
  } finally {
    restore();
  }
}

void run();
