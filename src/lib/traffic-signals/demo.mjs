/** Local TEST/DEMO only. Never imported by the driving UI or public API. */

export function demoFrame(elapsedMs) {
  const frames = [
    { phase: "red", remainingSeconds: 10 },
    { phase: "red", remainingSeconds: 9 },
    { phase: "red", remainingSeconds: 8 },
    { phase: "amber", remainingSeconds: 3 },
    { phase: "green", remainingSeconds: 10 },
    { phase: "green", remainingSeconds: 9 },
    { phase: "green", remainingSeconds: 8 },
  ];
  const index = Math.max(0, Math.min(frames.length - 1, Math.floor(elapsedMs / 1000)));
  return {
    intersectionId: "demo-local",
    signalId: "DEMO",
    source: "local-fixture",
    sourceUrl: null,
    location: { lng: 120.2049, lat: 22.9878 },
    locationConfidence: "reported",
    routeApproach: "north",
    expectedApproach: "north",
    signalGroup: "demo",
    movement: "straight",
    phase: frames[index].phase,
    remainingSeconds: frames[index].remainingSeconds,
    remainingMode: "demo_only",
    sourceTimestamp: null,
    expiresAt: null,
    lastVerifiedAt: null,
    status: "blocked",
  };
}
