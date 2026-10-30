import type { NavAutoZoomPhase } from "@/lib/nav-auto-zoom";
import { lineLengthMeters, pointAlongRoute, sliceRouteAhead } from "@/lib/upcoming-route";

export type PreviewMode = "overview" | "junction";

export type LocalPoint = { x: number; y: number };

export type PreviewPolyline = {
  points: LocalPoint[];
  kind: "context" | "approach" | "depart" | "route";
};

export type PreviewMarker = {
  at: LocalPoint;
  kind: "position" | "destination" | "maneuver";
};

export type PreviewLabel = {
  at: LocalPoint;
  text: string;
};

export type PreviewScene = {
  mode: PreviewMode;
  width: number;
  height: number;
  lines: PreviewPolyline[];
  markers: PreviewMarker[];
  labels: PreviewLabel[];
};

const VIEW_W = 160;
const VIEW_H = 112;
const PAD = 14;

/** Junction card while the camera is in the turn; overview once it releases. */
export function previewModeForPhase(phase: NavAutoZoomPhase): PreviewMode {
  return phase === "approach" || phase === "turning" ? "junction" : "overview";
}

export function toLocalMeters(coords: [number, number][]): LocalPoint[] {
  if (!coords.length) return [];
  const lng0 = coords[0][0];
  const lat0 = coords[0][1];
  const cos = Math.cos((lat0 * Math.PI) / 180);
  return coords.map(([lng, lat]) => ({
    x: (lng - lng0) * 111_320 * cos,
    y: (lat - lat0) * 110_540,
  }));
}

function perpendicularDistance(point: LocalPoint, start: LocalPoint, end: LocalPoint) {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const length = Math.hypot(dx, dy);
  if (length < 1e-6) return Math.hypot(point.x - start.x, point.y - start.y);
  return Math.abs(dy * point.x - dx * point.y + end.x * start.y - end.y * start.x) / length;
}

export function douglasPeucker(points: LocalPoint[], epsilon: number): LocalPoint[] {
  if (points.length < 3) return points.slice();
  let maxDistance = 0;
  let index = 0;
  const start = points[0];
  const end = points[points.length - 1];
  for (let i = 1; i < points.length - 1; i += 1) {
    const distance = perpendicularDistance(points[i], start, end);
    if (distance > maxDistance) {
      maxDistance = distance;
      index = i;
    }
  }
  if (maxDistance <= epsilon) return [start, end];
  const left = douglasPeucker(points.slice(0, index + 1), epsilon);
  const right = douglasPeucker(points.slice(index), epsilon);
  return left.slice(0, -1).concat(right);
}

export function simplifyLngLat(
  coords: [number, number][],
  epsilonMeters: number,
): [number, number][] {
  if (coords.length < 3) return coords.slice();
  const local = toLocalMeters(coords);
  const kept = douglasPeucker(local, epsilonMeters);
  const lng0 = coords[0][0];
  const lat0 = coords[0][1];
  const cos = Math.cos((lat0 * Math.PI) / 180) || 1;
  return kept.map((point) => [
    lng0 + point.x / (111_320 * cos),
    lat0 + point.y / 110_540,
  ]);
}

function fitTransform(points: LocalPoint[], width: number, height: number, pad: number) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const point of points) {
    minX = Math.min(minX, point.x);
    minY = Math.min(minY, point.y);
    maxX = Math.max(maxX, point.x);
    maxY = Math.max(maxY, point.y);
  }
  if (!Number.isFinite(minX)) {
    return (point: LocalPoint) => point;
  }
  const spanX = Math.max(8, maxX - minX);
  const spanY = Math.max(8, maxY - minY);
  const scale = Math.min((width - pad * 2) / spanX, (height - pad * 2) / spanY);
  const offsetX = (width - spanX * scale) / 2;
  const offsetY = (height - spanY * scale) / 2;
  return (point: LocalPoint): LocalPoint => ({
    x: offsetX + (point.x - minX) * scale,
    y: height - (offsetY + (point.y - minY) * scale),
  });
}

function asLng(point: { lng: number; lat: number } | null): [number, number] | null {
  if (!point) return null;
  return [point.lng, point.lat];
}

function localOf(origin: [number, number], coord: [number, number]): LocalPoint {
  const cos = Math.cos((origin[1] * Math.PI) / 180) || 1;
  return {
    x: (coord[0] - origin[0]) * 111_320 * cos,
    y: (coord[1] - origin[1]) * 110_540,
  };
}

function sceneFrom(
  mode: PreviewMode,
  lines: [number, number][][],
  kinds: PreviewPolyline["kind"][],
  markers: Array<{ at: [number, number]; kind: PreviewMarker["kind"] }>,
  labels: Array<{ at: [number, number]; text: string }> = [],
): PreviewScene {
  const origin = lines.flat()[0] ?? markers[0]?.at ?? [0, 0];
  const localLines = lines.map((line) => line.map((coord) => localOf(origin, coord)));
  const localMarkers = markers.map((marker) => ({
    kind: marker.kind,
    at: localOf(origin, marker.at),
  }));
  const localLabels = labels
    .filter((label) => label.text.trim().length > 0)
    .slice(0, 4)
    .map((label) => ({
      text: label.text.trim(),
      at: localOf(origin, label.at),
    }));
  const cloud = localLines
    .flat()
    .concat(localMarkers.map((marker) => marker.at))
    .concat(localLabels.map((label) => label.at));
  const project = fitTransform(cloud, VIEW_W, VIEW_H, PAD);
  const epsilon = mode === "overview" ? 18 : 4;
  return {
    mode,
    width: VIEW_W,
    height: VIEW_H,
    lines: localLines.map((points, index) => ({
      kind: kinds[index] ?? "context",
      points: douglasPeucker(points, epsilon).map(project),
    })),
    markers: localMarkers.map((marker) => ({
      kind: marker.kind,
      at: project(marker.at),
    })),
    labels: localLabels.map((label) => ({
      text: label.text,
      at: project(label.at),
    })),
  };
}

export function buildOverviewScene(
  route: [number, number][],
  routeMeters: number,
  roads: Array<{ line: [number, number][]; name?: string }> = [],
): PreviewScene {
  const simplified = simplifyLngLat(route, 22);
  const position = asLng(pointAlongRoute(route, Math.max(0, routeMeters)));
  const destination = route[route.length - 1] ?? null;
  const start = route[0] ?? null;
  const markers: Array<{ at: [number, number]; kind: PreviewMarker["kind"] }> = [];
  if (position) markers.push({ at: position, kind: "position" });
  if (start && (!position || start[0] !== position[0] || start[1] !== position[1])) {
    markers.push({ at: start, kind: "maneuver" });
  }
  if (destination) markers.push({ at: destination, kind: "destination" });
  const context = roads.filter((road) => road.line.length >= 2);
  const labels = context
    .filter((road) => road.name)
    .map((road) => ({
      text: road.name ?? "",
      at: road.line[Math.floor(road.line.length / 2)] ?? road.line[0],
    }));
  return sceneFrom(
    "overview",
    [simplified, ...context.map((road) => simplifyLngLat(road.line, 18))],
    ["route", ...context.map(() => "context" as const)],
    markers,
    labels,
  );
}

export function buildJunctionScene(
  route: [number, number][],
  routeMeters: number,
  apexMeters: number,
  context: [number, number][][] = [],
): PreviewScene {
  const total = lineLengthMeters(route);
  const from = Math.max(0, apexMeters - 150);
  const ahead = Math.min(total - from, 210);
  const slice = sliceRouteAhead(route, from, Math.max(24, ahead));
  const splitAt = Math.max(0, apexMeters - from);
  const approach = sliceRouteAhead(slice, 0, Math.max(8, splitAt));
  const depart = sliceRouteAhead(slice, splitAt, 56);
  const position = asLng(pointAlongRoute(route, Math.max(0, Math.min(total, routeMeters))));
  const maneuver = asLng(pointAlongRoute(route, Math.max(0, Math.min(total, apexMeters))));
  const packed: Array<{ line: [number, number][]; kind: PreviewPolyline["kind"] }> = [
    ...context
      .filter((line) => line.length >= 2)
      .map((line) => ({ line: simplifyLngLat(line, 6), kind: "context" as const })),
    { line: approach, kind: "approach" as const },
    { line: depart, kind: "depart" as const },
  ].filter((item) => item.line.length >= 2);
  const markers: Array<{ at: [number, number]; kind: PreviewMarker["kind"] }> = [];
  if (position) markers.push({ at: position, kind: "position" });
  if (maneuver) markers.push({ at: maneuver, kind: "maneuver" });
  return sceneFrom(
    "junction",
    packed.map((item) => item.line),
    packed.map((item) => item.kind),
    markers,
  );
}

export function activeTurnApex(turnCues: number[], routeMeters: number) {
  const upcoming = turnCues
    .filter((meters) => meters >= routeMeters - 24)
    .sort((a, b) => a - b);
  return upcoming[0] ?? null;
}

export function pointsToPath(points: LocalPoint[]) {
  if (!points.length) return "";
  return points
    .map((point, index) => `${index === 0 ? "M" : "L"}${point.x.toFixed(1)} ${point.y.toFixed(1)}`)
    .join(" ");
}
