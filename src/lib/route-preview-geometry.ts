import { bearingDegrees, destinationPoint, distanceKm } from "@/lib/geo";
import type { NavAutoZoomPhase } from "@/lib/nav-auto-zoom";
import { lineLengthMeters, pointAlongRoute } from "@/lib/upcoming-route";

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
  const width = mode === "junction" ? 200 : VIEW_W;
  const height = mode === "junction" ? 200 : VIEW_H;
  const project = fitTransform(cloud, width, height, mode === "junction" ? 34 : PAD);
  const epsilon = mode === "overview" ? 18 : 3;
  const north = spin({ x: 0, y: 1 });
  const northDeg = (Math.atan2(north.x, north.y) * 180) / Math.PI;
  const drawn = localLines.map((points, index) => ({
    kind: kinds[index] ?? "context",
    points: douglasPeucker(points, epsilon).map(project),
  }));
  const routeLine = drawn.find((line) => line.kind === "route");
  const depart = drawn.find((line) => line.kind === "depart");
  return {
    mode,
    width,
    height,
    lines: drawn,
    blocks: localBlocks.map((ring) => douglasPeucker(ring, 6).map(project)),
    markers: localMarkers.map((marker) => ({
      kind: marker.kind,
      at: project(marker.at),
      heading: marker.kind === "position" ? 0 : undefined,
    })),
    labels: placeLabels(
      localLabels.map((label) => ({
        text: label.text,
        at: project(label.at),
      })),
      width,
      height,
      mode === "junction" ? 0 : 12,
    ),
    arrow: arrowHead(routeLine?.points ?? depart?.points ?? []),
    northDeg,
  };
}

function placeLabels(
  labels: PreviewLabel[],
  width: number,
  height: number,
  nudgeY = 12,
): PreviewLabel[] {
  const kept: Array<{ label: PreviewLabel; left: number; right: number; top: number; bottom: number }> = [];
  const inset = 14;
  for (const label of labels) {
    const textWidth = Math.max(22, label.text.length * 9);
    const textHeight = 14;
    let x = label.at.x;
    let y = label.at.y - nudgeY;
    x = Math.min(width - inset - textWidth / 2, Math.max(inset + textWidth / 2, x));
    y = Math.min(height - inset, Math.max(inset + textHeight, y));
    const box = {
      left: x - textWidth / 2,
      right: x + textWidth / 2,
      top: y - textHeight,
      bottom: y + 2,
    };
    if (box.left < 6 || box.right > width - 6 || box.top < 6 || box.bottom > height - 6) continue;
    const hits = kept.some(
      (item) =>
        box.left < item.right + 4 &&
        box.right > item.left - 4 &&
        box.top < item.bottom + 4 &&
        box.bottom > item.top - 4,
    );
    if (hits) continue;
    kept.push({ label: { text: label.text, at: { x, y } }, ...box });
  }
  return kept.map((item) => item.label);
}

function arrowHead(points: LocalPoint[]): LocalPoint[] {
  if (points.length < 2) return [];
  const tip = points[points.length - 1];
  const prev = points[points.length - 2];
  const angle = Math.atan2(tip.y - prev.y, tip.x - prev.x);
  const back = 22;
  const wing = 11;
  const left = angle + Math.PI - 0.7;
  const right = angle + Math.PI + 0.7;
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

function turnDelta(from: number, to: number) {
  return Math.abs(((to - from + 540) % 360) - 180);
}

/** Angle between two road axes, so a northbound and southbound trace of the same street match. */
function axisDelta(from: number, to: number) {
  const delta = turnDelta(from, to);
  return Math.min(delta, 180 - delta);
}

function lineBearing(line: [number, number][]) {
  const from = { lng: line[0][0], lat: line[0][1] };
  const to = { lng: line[line.length - 1][0], lat: line[line.length - 1][1] };
  return bearingDegrees(from, to);
}

function lineMidpoint(line: [number, number][]) {
  const mid = line[Math.floor(line.length / 2)] ?? line[0];
  return { lng: mid[0], lat: mid[1] };
}

function metersToSegment(
  point: { lng: number; lat: number },
  line: [number, number][],
) {
  const origin = line[0];
  const toLocal = (coord: [number, number]) => localOf(origin, coord);
  const target = toLocal([point.lng, point.lat]);
  let best = Infinity;
  for (let index = 1; index < line.length; index += 1) {
    const start = toLocal(line[index - 1]);
    const end = toLocal(line[index]);
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const lengthSq = dx * dx + dy * dy;
    const t =
      lengthSq < 1e-6
        ? 0
        : Math.min(1, Math.max(0, ((target.x - start.x) * dx + (target.y - start.y) * dy) / lengthSq));
    best = Math.min(best, Math.hypot(target.x - (start.x + dx * t), target.y - (start.y + dy * t)));
  }
  return best;
}

/** One centreline per street: drop specks, and fold dual carriageways that share a name or sit within 15 m. */
export function mergeJunctionRoads<T extends { line: [number, number][]; name?: string }>(
  roads: T[],
): T[] {
  const sorted = roads
    .filter((road) => road.line.length >= 2 && lineLengthMeters(road.line) >= 36)
    .slice()
    .sort((a, b) => lineLengthMeters(b.line) - lineLengthMeters(a.line));
  const kept: T[] = [];
  for (const road of sorted) {
    const mid = lineMidpoint(road.line);
    const bearing = lineBearing(road.line);
    const duplicate = kept.some((other) => {
      const otherMid = lineMidpoint(other.line);
      const gap = Math.min(metersToSegment(mid, other.line), metersToSegment(otherMid, road.line));
      const sameName = Boolean(road.name) && road.name === other.name;
      const parallel = axisDelta(bearing, lineBearing(other.line)) <= 18;
      return gap <= 15 && (sameName || parallel);
    });
    if (!duplicate) kept.push(road);
  }
  return kept;
}

/** Clip a centreline to the junction disc. Segments that only graze the disc become short and are dropped later. */
export function clipLineToRadius(
  line: [number, number][],
  center: { lng: number; lat: number },
  radiusMeters: number,
): [number, number][] {
  const distanceTo = (coord: [number, number]) =>
    distanceKm({ lng: coord[0], lat: coord[1] }, center) * 1000;
  const hits: [number, number][] = [];
  const push = (coord: [number, number]) => {
    const prev = hits[hits.length - 1];
    if (prev && Math.abs(prev[0] - coord[0]) < 1e-9 && Math.abs(prev[1] - coord[1]) < 1e-9) return;
    hits.push(coord);
  };
  for (let index = 1; index < line.length; index += 1) {
    const start = line[index - 1];
    const end = line[index];
    const steps = 8;
    let prev = start;
    let prevDist = distanceTo(start);
    for (let step = 1; step <= steps; step += 1) {
      const t = step / steps;
      const next: [number, number] = [
        start[0] + (end[0] - start[0]) * t,
        start[1] + (end[1] - start[1]) * t,
      ];
      const nextDist = distanceTo(next);
      const prevIn = prevDist <= radiusMeters;
      const nextIn = nextDist <= radiusMeters;
      if (prevIn && nextIn) {
        push(prev);
        push(next);
      } else if (prevIn !== nextIn) {
        const span = nextDist - prevDist;
        const edgeT = span === 0 ? 0 : (radiusMeters - prevDist) / span;
        const clamped = Math.min(1, Math.max(0, edgeT));
        const edge: [number, number] = [
          prev[0] + (next[0] - prev[0]) * clamped,
          prev[1] + (next[1] - prev[1]) * clamped,
        ];
        if (prevIn) {
          push(prev);
          push(edge);
        } else {
          push(edge);
          if (nextIn) push(next);
        }
      }
      prev = next;
      prevDist = nextDist;
    }
  }
  return hits.length >= 2 ? hits : [];
}

/**
 * One crossbar only, and only when the basemap contributed nothing usable.
 * The bar follows the exit when the turn is real, otherwise it sits square to the approach.
 */
export function fallbackJunctionRoads(
  route: [number, number][],
  apexMeters: number,
  _names: { approach?: string; exit?: string } = {},
): Array<{ line: [number, number][]; name: string; rank: "major" | "minor" }> {
  const apex = pointAlongRoute(route, Math.max(0, apexMeters));
  if (!apex) return [];
  const approachPose = pointAlongRoute(route, Math.max(0, apexMeters - 24));
  const exitPose = pointAlongRoute(route, apexMeters + 24);
  const approachBearing = approachPose?.bearing ?? apex.bearing;
  const exitBearing = exitPose?.bearing ?? approachBearing;
  const turn = turnDelta(approachBearing, exitBearing);
  const barBearing = turn > 32 ? exitBearing : approachBearing + 90;
  const center = { lng: apex.lng, lat: apex.lat };
  const left = destinationPoint(center, 68, barBearing);
  const right = destinationPoint(center, 68, barBearing + 180);
  return [
    {
      line: [
        [left.lng, left.lat],
        [center.lng, center.lat],
        [right.lng, right.lat],
      ],
      name: "",
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
  const apex = Math.max(0, Math.min(total, apexMeters));
  const carMeters = Math.max(0, Math.min(apex, routeMeters));
  const apexPoint = pointAlongRoute(route, apex);
  const approachPose = pointAlongRoute(route, Math.max(0, apex - 16));
  const exitPose = pointAlongRoute(route, Math.min(total, apex + 22));
  const approachBearing = approachPose?.bearing ?? apexPoint?.bearing ?? 0;
  const exitBearing = exitPose?.bearing ?? approachBearing;
  const center = apexPoint ? { lng: apexPoint.lng, lat: apexPoint.lat } : null;
  const behindCar = apex - carMeters;
  const tail = center ? destinationPoint(center, behindCar + 36, approachBearing + 180) : null;
  const car = center ? destinationPoint(center, behindCar, approachBearing + 180) : null;
  const exitEnd = center ? destinationPoint(center, 64, exitBearing) : null;
  const approach: [number, number][] =
    tail && center ? [[tail.lng, tail.lat], [center.lng, center.lat]] : [];
  const depart: [number, number][] =
    center && exitEnd ? [[center.lng, center.lat], [exitEnd.lng, exitEnd.lat]] : [];
  const yellow: [number, number][] =
    car && center && exitEnd
      ? behindCar > 0.8
        ? [[car.lng, car.lat], [center.lng, center.lat], [exitEnd.lng, exitEnd.lat]]
        : [[center.lng, center.lat], [exitEnd.lng, exitEnd.lat]]
      : [];
  const position = yellow[0] ?? null;
  const maneuver = center ? ([center.lng, center.lat] as [number, number]) : null;
  const cardRadius = 74;
  const realCrosses = center
    ? mergeJunctionRoads(context.map(asSketch).filter((road) => road.line.length >= 2))
        .map((road) => ({ ...road, line: clipLineToRadius(road.line, center, cardRadius) }))
        .filter((road) => lineLengthMeters(road.line) >= 42)
        .filter((road) => {
          if (!approach.length) return true;
          const sameAsApproach =
            axisDelta(lineBearing(road.line), approachBearing) <= 18 &&
            metersToSegment(lineMidpoint(road.line), approach) <= 15;
          return !sameAsApproach;
        })
        .sort((a, b) => lineLengthMeters(b.line) - lineLengthMeters(a.line))
        .slice(0, 3)
    : [];
  // Stubs are a stand-in for a missing basemap, never an extra fan on top of real roads.
  const sketches = realCrosses.length
    ? realCrosses
    : maneuver
      ? fallbackJunctionRoads(route, apex, names)
      : [];
  const packed: Array<{ line: [number, number][]; kind: PreviewPolyline["kind"] }> = [
    ...sketches.map((road) => ({
      line: simplifyLngLat(road.line, 4),
      kind: (road.rank === "major" ? "major" : "context") as PreviewPolyline["kind"],
    })),
    { line: approach, kind: "approach" as const },
    { line: depart, kind: "depart" as const },
    { line: yellow, kind: "route" as const },
  ].filter((item) => item.line.length >= 2);
  const markers: Array<{ at: [number, number]; kind: PreviewMarker["kind"] }> = [];
  if (position) markers.push({ at: position, kind: "position" });
  if (maneuver) markers.push({ at: maneuver, kind: "maneuver" });
  const labels: Array<{ at: [number, number]; text: string }> = [];
  if (names.approach && center) {
    const along = destinationPoint(
      center,
      Math.min(52, behindCar * 0.4 + 20),
      approachBearing + 180,
    );
    const beside = destinationPoint(along, 34, approachBearing - 90);
    labels.push({ text: names.approach, at: [beside.lng, beside.lat] });
  }
  if (names.exit && center) {
    const signed = ((exitBearing - approachBearing + 540) % 360) - 180;
    const outside = signed >= 0 ? -90 : 90;
    const along = destinationPoint(center, 42, exitBearing);
    const beside = destinationPoint(along, 30, exitBearing + outside);
    labels.push({ text: names.exit, at: [beside.lng, beside.lat] });
  }
  const fills = blocks.length
    ? blocks
    : maneuver
      ? syntheticBlocks(maneuver, approachBearing)
      : [];
  return sceneFrom(
    "junction",
    packed.map((item) => item.line),
    packed.map((item) => item.kind),
    markers,
    labels,
    fills,
    approachBearing,
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
