import assert from "node:assert/strict";
import { destinationPoint } from "../geo";
import { simulateYunlinAlleyZoom, YUNLIN_ALLEY_TURN_CUES } from "../nav-auto-zoom";
import {
  activeTurnApex,
  buildJunctionScene,
  buildOverviewScene,
  douglasPeucker,
  mergeJunctionRoads,
  previewModeForPhase,
  simplifyLngLat,
} from "../route-preview-geometry";
import { lineLengthMeters } from "../upcoming-route";

function testModeFollowsAutoZoomPhase() {
  assert.equal(previewModeForPhase("cruise"), "overview");
  assert.equal(previewModeForPhase("recover"), "overview");
  assert.equal(previewModeForPhase("approach"), "junction");
  assert.equal(previewModeForPhase("turning"), "junction");
}

function testSimplifyKeepsEndsAndDropsWiggles() {
  const coords: [number, number][] = [];
  for (let i = 0; i <= 20; i += 1) {
    const wobble = i > 0 && i < 20 ? (i % 2 === 0 ? 0.000002 : -0.000002) : 0;
    coords.push([120.54 + wobble, 23.7 + i * 0.0002]);
  }
  const simplified = simplifyLngLat(coords, 8);
  assert.ok(simplified.length < coords.length);
  assert.ok(simplified.length >= 2);
  assert.equal(simplified[0][1], coords[0][1]);
  assert.equal(simplified[simplified.length - 1][1], coords[coords.length - 1][1]);
  const straight = douglasPeucker(
    [
      { x: 0, y: 0 },
      { x: 10, y: 0.2 },
      { x: 20, y: 0 },
    ],
    1,
  );
  assert.equal(straight.length, 2);
}

function elbowRoute() {
  const start = { lng: 120.5438, lat: 23.7072 };
  const legs = [
    { meters: 220, bearing: 0 },
    { meters: 70, bearing: 90 },
    { meters: 45, bearing: 0 },
    { meters: 225, bearing: 90 },
  ];
  const route: [number, number][] = [[start.lng, start.lat]];
  let cursor = start;
  for (const leg of legs) {
    const steps = 8;
    for (let step = 1; step <= steps; step += 1) {
      cursor = destinationPoint(cursor, leg.meters / steps, leg.bearing);
      route.push([cursor.lng, cursor.lat]);
    }
  }
  return route;
}

function testJunctionHighlightsTheExit() {
  const route = elbowRoute();
  const apex = lineLengthMeters(route.slice(0, 9));
  const scene = buildJunctionScene(route, apex - 40, apex, [
    [
      [120.543, 23.709],
      [120.546, 23.709],
    ],
  ]);
  assert.equal(scene.mode, "junction");
  assert.ok(scene.lines.some((line) => line.kind === "depart" && line.points.length >= 2));
  assert.ok(scene.lines.some((line) => line.kind === "context" || line.kind === "major"));
  const position = scene.markers.find((marker) => marker.kind === "position");
  const maneuver = scene.markers.find((marker) => marker.kind === "maneuver");
  assert.ok(position && maneuver);
  assert.ok(position.at.x > 0 && position.at.x < scene.width);
  assert.ok(maneuver.at.y > 0 && maneuver.at.y < scene.height);
  const bare = buildJunctionScene(route, apex - 40, apex, [], {
    approach: "民生路",
    exit: "文賢路",
  });
  assert.equal(
    bare.lines.filter((line) => line.kind === "major" || line.kind === "context").length,
    1,
  );
  assert.ok(bare.labels.some((label) => label.text === "民生路" || label.text === "文賢路"));
  assert.equal(bare.arrow.length, 3);
  assert.ok(bare.blocks.length >= 1);
  const yellow = bare.lines.find((line) => line.kind === "route");
  const car = bare.markers.find((marker) => marker.kind === "position");
  assert.ok(yellow && yellow.points.length >= 2 && car);
  assert.ok(Math.hypot(yellow.points[0].x - car.at.x, yellow.points[0].y - car.at.y) < 1.5);
  const stem = bare.lines.find((line) => line.kind === "approach");
  assert.ok(stem && stem.points.length >= 2);
  const stemDx = Math.abs(stem.points[0].x - stem.points[stem.points.length - 1].x);
  const stemDy = Math.abs(stem.points[0].y - stem.points[stem.points.length - 1].y);
  assert.ok(stemDy > stemDx * 4, `approach should be the upright stem, dx ${stemDx} dy ${stemDy}`);
  assert.ok(stem.points[0].y > stem.points[stem.points.length - 1].y);
  for (const label of bare.labels) {
    assert.ok(label.at.x > 8 && label.at.x < bare.width - 8);
    assert.ok(label.at.y > 8 && label.at.y < bare.height - 8);
  }
  for (let i = 0; i < bare.labels.length; i += 1) {
    for (let j = i + 1; j < bare.labels.length; j += 1) {
      const gap = Math.hypot(
        bare.labels[i].at.x - bare.labels[j].at.x,
        bare.labels[i].at.y - bare.labels[j].at.y,
      );
      assert.ok(gap > 16, `labels overlap: ${bare.labels[i].text} ${bare.labels[j].text}`);
    }
  }
  const overview = buildOverviewScene(route, apex - 40, [
    {
      line: [
        [120.543, 23.708],
        [120.548, 23.708],
      ],
      name: "中正路",
    },
  ]);
  assert.equal(overview.mode, "overview");
  assert.ok(overview.markers.some((marker) => marker.kind === "destination"));
  assert.ok(overview.markers.some((marker) => marker.kind === "position"));
  assert.ok(overview.lines.some((line) => line.kind === "context"));
  assert.ok(overview.labels.some((label) => label.text === "中正路"));
  assert.ok(overview.lines[0].points.length >= 2);
}

function testRealRoadsReplaceTheFallbackFan() {
  const route = elbowRoute();
  const apex = lineLengthMeters(route.slice(0, 9));
  const apexPoint = route[8];
  const arm = (meters: number, bearing: number) => {
    const head = destinationPoint({ lng: apexPoint[0], lat: apexPoint[1] }, meters, bearing);
    const tail = destinationPoint({ lng: apexPoint[0], lat: apexPoint[1] }, meters, bearing + 180);
    return [
      [tail.lng, tail.lat],
      [apexPoint[0], apexPoint[1]],
      [head.lng, head.lat],
    ] as [number, number][];
  };
  const fan = [0, 45, 90, 135, 180, 225].map((bearing) => arm(80, bearing));
  const crowded = buildJunctionScene(route, apex - 40, apex, fan);
  const crosses = crowded.lines.filter((line) => line.kind === "major" || line.kind === "context");
  assert.ok(crosses.length >= 1 && crosses.length <= 3, `fan collapsed to ${crosses.length}`);
  const parallel = destinationPoint({ lng: apexPoint[0], lat: apexPoint[1] }, 10, 0);
  const merged = mergeJunctionRoads([
    { line: arm(90, 90), name: "文賢路" },
    {
      line: [
        [parallel.lng - 0.0008, parallel.lat],
        [parallel.lng + 0.0008, parallel.lat],
      ] as [number, number][],
      name: "文賢路",
    },
    { line: arm(12, 40), name: "巷道" },
  ]);
  assert.equal(merged.length, 1);
  const oneReal = buildJunctionScene(route, apex - 150, apex, [
    { line: arm(90, 90), name: "文賢路" },
    { line: arm(12, 40), name: "巷道" },
  ]);
  assert.equal(
    oneReal.lines.filter((line) => line.kind === "major" || line.kind === "context").length,
    1,
  );
  const farCar = oneReal.markers.find((marker) => marker.kind === "position");
  const farYellow = oneReal.lines.find((line) => line.kind === "route");
  assert.ok(farCar && farYellow);
  assert.ok(Math.hypot(farYellow.points[0].x - farCar.at.x, farYellow.points[0].y - farCar.at.y) < 1.5);
  assert.ok(farYellow.points[0].y > farYellow.points[farYellow.points.length - 1].y);
}

function testYunlinPreviewSwitchesWithCloseTurns() {
  const samples = simulateYunlinAlleyZoom();
  const modeAt = (meters: number) => {
    const sample = samples.find((item) => item.routeMeters === meters);
    assert.ok(sample);
    return previewModeForPhase(sample.phase);
  };
  assert.equal(modeAt(20), "overview");
  assert.equal(modeAt(140), "junction");
  assert.equal(modeAt(250), "junction");
  assert.equal(modeAt(300), "junction");
  assert.equal(modeAt(400), "overview");
  const apex = activeTurnApex([...YUNLIN_ALLEY_TURN_CUES], 250);
  assert.equal(apex, 290);
  const route = elbowRoute();
  const graphic = buildJunctionScene(route, 180, 220);
  assert.ok(graphic.lines.some((line) => line.kind === "depart"));
  console.log(
    samples
      .filter((sample) => sample.routeMeters % 40 === 0)
      .map((sample) => `${sample.routeMeters},${previewModeForPhase(sample.phase)},${sample.phase}`)
      .join("\n"),
  );
}

testModeFollowsAutoZoomPhase();
testSimplifyKeepsEndsAndDropsWiggles();
testJunctionHighlightsTheExit();
testRealRoadsReplaceTheFallbackFan();
testYunlinPreviewSwitchesWithCloseTurns();
console.log(JSON.stringify({ ok: true, suite: "route-preview-geometry", tests: 5 }));
