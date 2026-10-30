import { destinationPoint } from "@/lib/geo";
import type { NavAutoZoomPhase } from "@/lib/nav-auto-zoom";
import { lineLengthMeters, pointAlongRoute, sliceRouteAhead } from "@/lib/upcoming-route";

export type PreviewMode = "overview" | "junction";

export type LocalPoint = { x: number; y: number };

export type PreviewPolyline = {
  points: LocalPoint[];
  kind: "context" | "major" | "approach" | "depart" | "route";
};

export type PreviewMarker = {
  at: LocalPoint;
  kind: "position" | "destination" | "maneuver";
  /** Degrees clockwise from screen-up. The junction view is heading-up, so the car is 0. */
  heading?: number;
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
  blocks: LocalPoint[][];
  markers: PreviewMarker[];
  labels: PreviewLabel[];
  /** Arrowhead on the exit, in screen space. */
  arrow: LocalPoint[];
  /** Clockwise degrees from screen-up to north. */
  northDeg: number;
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

function rotateLocal(point: LocalPoint, theta: number): LocalPoint {
  const c = Math.cos(theta);
  const s = Math.sin(theta);
  return { x: point.x * c - point.y * s, y: point.x * s + point.y * c };
}

function sceneFrom(
  mode: PreviewMode,
  lines: [number, number][][],
  kinds: PreviewPolyline["kind"][],
  markers: Array<{ at: [number, number]; kind: PreviewMarker["kind"] }>,
  labels: Array<{ at: [number, number]; text: string }> = [],
  blocks: [number, number][][] = [],
  alignBearing: number | null = null,
): PreviewScene {
  const origin = lines.flat()[0] ?? markers[0]?.at ?? blocks.flat()[0] ?? [0, 0];
  const travel =
    alignBearing == null
      ? null
      : { x: Math.sin((alignBearing * Math.PI) / 180), y: Math.cos((alignBearing * Math.PI) / 180) };
  const theta =
    travel == null ? 0 : Math.PI / 2 - Math.atan2(travel.y, travel.x);
  const spin = (point: LocalPoint) => (alignBearing == null ? point : rotateLocal(point, theta));
  const localLines = lines.map((line) => line.map((coord) => spin(localOf(origin, coord))));
  const localMarkers = markers.map((marker) => ({
    kind: marker.kind,
    at: spin(localOf(origin, marker.at)),
  }));
  const localLabels = labels
    .filter((label) => label.text.trim().length > 0)
    .slice(0, 4)
    .map((label) => ({
      text: label.text.trim(),
      at: spin(localOf(origin, label.at)),
    }));
  const localBlocks = blocks.map((ring) => ring.map((coord) => spin(localOf(origin, coord))));
  const cloud = localLines
    .flat()
    .concat(localMarkers.map((marker) => marker.at))
    .concat(localLabels.map((label) => label.at));
  const project = fitTransform(cloud, VIEW_W, VIEW_H, PAD);
  const epsilon = mode === "overview" ? 18 : 3;
  const north = spin({ x: 0, y: 1 });
  const northDeg = (Math.atan2(north.x, north.y) * 180) / Math.PI;
  const drawn = localLines.map((points, index) => ({
    kind: kinds[index] ?? "context",
    points: douglasPeucker(points, epsilon).map(project),
  }));
  const depart = drawn.find((line) => line.kind === "depart");
  return {
    mode,
    width: VIEW_W,
    height: VIEW_H,
    lines: drawn,
    blocks: localBlocks.map((ring) => douglasPeucker(ring, 6).map(project)),
    markers: localMarkers.map((marker) => ({
      kind: marker.kind,
      at: project(marker.at),
      heading: marker.kind === "position" ? 0 : undefined,
    })),
    labels: localLabels.map((label) => ({
      text: label.text,
      at: project(label.at),
    })),
    arrow: arrowHead(depart?.points ?? []),
    northDeg,
  };
}

function arrowHead(points: LocalPoint[]): LocalPoint[] {
  if (points.length < 2) return [];
  const tip = points[points.length - 1];
  const prev = points[points.length - 2];
  const angle = Math.atan2(tip.y - prev.y, tip.x - prev.x);
  const back = 9;
  const wing = 5;
  const left = angle + Math.PI - 0.55;
  const right = angle + Math.PI + 0.55;
  return [
    tip,
    { x: tip.x + Math.cos(left) * back + Math.cos(angle + Math.PI / 2) * wing * 0.15, y: tip.y + Math.sin(left) * back },
    { x: tip.x + Math.cos(right) * back, y: tip.y + Math.sin(right) * back },
  ];
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

type SketchInput =
  | [number, number][]
  | { line: [number, number][]; name?: string; rank?: "major" | "minor" };

function asSketch(input: SketchInput): { line: [number, number][]; name: string; rank: "major" | "minor" } {
  if (Array.isArray(input)) return { line: input, name: "", rank: "minor" };
  return { line: input.line, name: input.name ?? "", rank: input.rank === "major" ? "major" : "minor" };
}

/** Cross-street stubs when the basemap has no rendered roads at the junction. */
export function fallbackJunctionRoads(
  route: [number, number][],
  apexMeters: number,
  names: { approach?: string; exit?: string } = {},
): Array<{ line: [number, number][]; name: string; rank: "major" | "minor" }> {
  const apex = pointAlongRoute(route, Math.max(0, apexMeters));
  if (!apex) return [];
  const approachPose = pointAlongRoute(route, Math.max(0, apexMeters - 24));
  const bearing = approachPose?.bearing ?? apex.bearing;
  const center = { lng: apex.lng, lat: apex.lat };
  const left = destinationPoint(center, 42, bearing - 90);
  const right = destinationPoint(center, 42, bearing + 90);
  return [
    {
      line: [
        [left.lng, left.lat],
        [apex.lng, apex.lat],
        [right.lng, right.lat],
      ],
      name: names.exit || names.approach || "",
      rank: "major",
    },
  ];
}

function syntheticBlocks(apex: [number, number], bearing: number): [number, number][][] {
  const center = { lng: apex[0], lat: apex[1] };
  const spots = [
    { distance: 28, angle: bearing + 135 },
    { distance: 32, angle: bearing - 140 },
    { distance: 26, angle: bearing + 50 },
  ];
  return spots.map((spot) => {
    const origin = destinationPoint(center, spot.distance, spot.angle);
    const corners = [0, 90, 180, 270].map((turn) => {
      const point = destinationPoint(origin, 8, spot.angle + turn);
      return [point.lng, point.lat] as [number, number];
    });
    return [...corners, corners[0]];
  });
}

export function buildJunctionScene(
  route: [number, number][],
  routeMeters: number,
  apexMeters: number,
  context: SketchInput[] = [],
  names: { approach?: string; exit?: string } = {},
  blocks: [number, number][][] = [],
): PreviewScene {
  const total = lineLengthMeters(route);
  const from = Math.max(0, apexMeters - 90);
  const ahead = Math.min(total - from, 150);
  const slice = sliceRouteAhead(route, from, Math.max(24, ahead));
  const splitAt = Math.max(0, apexMeters - from);
  const approach = sliceRouteAhead(slice, 0, Math.max(8, splitAt));
  const depart = sliceRouteAhead(slice, splitAt, 48);
  const position = asLng(pointAlongRoute(route, Math.max(0, Math.min(total, routeMeters))));
  const maneuver = asLng(pointAlongRoute(route, Math.max(0, Math.min(total, apexMeters))));
  const approachPose = pointAlongRoute(route, Math.max(0, apexMeters - 12));
  const roads = context.map(asSketch).filter((road) => road.line.length >= 2);
  const sketches = roads.length
    ? roads
    : maneuver
      ? fallbackJunctionRoads(route, apexMeters, names)
      : [];
  const packed: Array<{ line: [number, number][]; kind: PreviewPolyline["kind"] }> = [
    ...sketches.map((road) => ({
      line: simplifyLngLat(road.line, 4),
      kind: (road.rank === "major" ? "major" : "context") as PreviewPolyline["kind"],
    })),
    { line: approach, kind: "approach" as const },
    { line: depart, kind: "depart" as const },
  ].filter((item) => item.line.length >= 2);
  const markers: Array<{ at: [number, number]; kind: PreviewMarker["kind"] }> = [];
  if (position) markers.push({ at: position, kind: "position" });
  if (maneuver) markers.push({ at: maneuver, kind: "maneuver" });
  const labels: Array<{ at: [number, number]; text: string }> = [];
  if (names.approach && approach.length) {
    labels.push({ text: names.approach, at: approach[Math.max(0, approach.length - 2)] });
  }
  if (names.exit && depart.length) {
    labels.push({ text: names.exit, at: depart[Math.min(depart.length - 1, 1)] });
  }
  for (const road of sketches) {
    if (!road.name || labels.some((label) => label.text === road.name)) continue;
    if (labels.length >= 4) break;
    labels.push({
      text: road.name,
      at: road.line[Math.floor(road.line.length / 2)] ?? road.line[0],
    });
  }
  const fills = blocks.length
    ? blocks
    : maneuver
      ? syntheticBlocks(maneuver, approachPose?.bearing ?? 0)
      : [];
  return sceneFrom(
    "junction",
    packed.map((item) => item.line),
    packed.map((item) => item.kind),
    markers,
    labels,
    fills,
    approachPose?.bearing ?? null,
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
