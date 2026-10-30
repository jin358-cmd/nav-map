import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { demoFrame } from "../src/lib/traffic-signals/demo.mjs";
import { projectSignal, recordToSignal, validTaiwanPoint } from "../src/lib/traffic-signals/project.mjs";
import { querySignals } from "../src/lib/traffic-signals/query.mjs";

const catalog = JSON.parse(
  readFileSync(new URL("../fixtures/traffic-signals/tainan-110-signals.json", import.meta.url), "utf8"),
);
assert.equal(catalog.countdown, "unavailable");
assert.ok(catalog.signals.length > 1000);
assert.equal(catalog.signals.some((row) => row[2] == null && row.length < 3), false);

const countdownHardware = catalog.signals.find((row) => String(row[4] ?? "").includes("倒數"));
assert.ok(countdownHardware, "historical equipment note should remain in the extract");
const hardwareSignal = recordToSignal(countdownHardware);
assert.equal(hardwareSignal.remainingSeconds, null);
assert.equal(hardwareSignal.remainingMode, "unavailable");
assert.equal(projectSignal(hardwareSignal).label, "🚦 --");
assert.equal(projectSignal(hardwareSignal).showColor, false);
assert.equal(projectSignal(hardwareSignal).seconds, null);

const outside = projectSignal({
  location: { lng: 0, lat: 0 },
  remainingMode: "verified_live",
  remainingSeconds: 10,
  phase: "green",
});
assert.equal(outside.drawable, false);
assert.ok(validTaiwanPoint({ lng: 120.2, lat: 23 }));

const now = Date.parse("2026-10-29T15:00:00+08:00");
const live = {
  location: { lng: 120.2049, lat: 22.9878 },
  remainingMode: "verified_live",
  status: "live",
  phase: "green",
  remainingSeconds: 20,
  routeApproach: "north",
  expectedApproach: "north",
  movement: "straight",
  sourceTimestamp: "2026-10-29T14:59:50+08:00",
  expiresAt: "2026-10-29T15:00:20+08:00",
};
assert.equal(projectSignal(live, { nowMs: now }).seconds, 20);
assert.equal(projectSignal(live, { nowMs: Date.parse("2026-10-29T15:00:21+08:00") }).seconds, null);
assert.equal(
  projectSignal({ ...live, expectedApproach: "south" }, { nowMs: now }).seconds,
  null,
);
assert.equal(projectSignal({ ...live, remainingSeconds: -1 }, { nowMs: now }).seconds, null);
assert.equal(projectSignal({ ...live, remainingSeconds: 90 }, { nowMs: now }).seconds, null);

for (const elapsed of [0, 1000, 2000]) {
  const frame = demoFrame(elapsed);
  const hidden = projectSignal(frame);
  assert.equal(hidden.demo, false);
  assert.equal(hidden.seconds, null);
  assert.equal(hidden.label, "🚦 --");
  const shown = projectSignal(frame, { allowDemo: true });
  assert.equal(shown.demo, true);
  assert.ok(shown.label.startsWith("TEST/DEMO"));
}
assert.deepEqual(
  [demoFrame(0).remainingSeconds, demoFrame(1000).remainingSeconds, demoFrame(2000).remainingSeconds],
  [10, 9, 8],
);

const nearby = querySignals({
  west: 120.28,
  south: 23.02,
  east: 120.3,
  north: 23.05,
  zoom: 16,
  center: { lng: 120.29, lat: 23.03 },
  limit: 20,
});
assert.equal(nearby.liveCountdown, "blocked");
assert.ok(nearby.signals.length > 0);
assert.ok(nearby.signals.every((signal) => signal.remainingSeconds == null));
assert.ok(nearby.signals.every((signal) => signal.presentation.label === "🚦 --"));
assert.ok(nearby.signals.every((signal) => signal.presentation.showColor === false));

const far = querySignals({
  west: 121.4,
  south: 25.0,
  east: 121.6,
  north: 25.2,
  zoom: 16,
  center: { lng: 121.5, lat: 25.05 },
});
assert.equal(far.signals.length, 0);
assert.equal(
  querySignals({ west: 120.2, south: 22.9, east: 120.3, north: 23.05, zoom: 13, center: null }).reason,
  "zoom",
);

console.log(JSON.stringify({
  signals: catalog.signals.length,
  sample: nearby.signals.length,
  taipei: far.signals.length,
}, null, 2));
console.log("traffic-signal-selftest PASS");
