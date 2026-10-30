import type { LocationPrecision, RoadEventGeometry } from "./types";
import { twd97Tm2ToWgs84 } from "./twd97";

type Pair = [number, number];

const TAIWAN = { west: 118, south: 21.5, east: 122.8, north: 26.6 };

export function inTaiwan(lng: number, lat: number) {
  return (
    lng >= TAIWAN.west &&
    lng <= TAIWAN.east &&
    lat >= TAIWAN.south &&
    lat <= TAIWAN.north
  );
}

export function precisionOf(geometry: RoadEventGeometry | null): LocationPrecision {
  if (!geometry) return "none";
  if (geometry.type === "Point" || geometry.type === "MultiPoint") return "point";
  if (geometry.type === "LineString" || geometry.type === "MultiLineString") {
    return "line";
  }
  return "area";
}

export function precisionRank(precision: LocationPrecision) {
  if (precision === "area") return 3;
  if (precision === "line") return 2;
  if (precision === "point") return 1;
  return 0;
}

function walkPairs(node: unknown, into: Pair[]) {
  if (!Array.isArray(node) || node.length === 0) return;
  if (typeof node[0] === "number" && typeof node[1] === "number") {
    into.push([node[0], node[1]]);
    return;
  }
  for (const child of node) walkPairs(child, into);
}

export function allPositions(geometry: RoadEventGeometry | null): Pair[] {
  if (!geometry) return [];
  if (geometry.type === "Point") return [geometry.coordinates];
  const pairs: Pair[] = [];
  walkPairs(geometry.coordinates, pairs);
  return pairs;
}

export function geometryUsable(geometry: RoadEventGeometry | null) {
  const pairs = allPositions(geometry);
  return pairs.length > 0 && pairs.every(([lng, lat]) => inTaiwan(lng, lat));
}

export function representativeLngLat(geometry: RoadEventGeometry | null): Pair | null {
  if (!geometry || !geometryUsable(geometry)) return null;
  if (geometry.type === "Point") return geometry.coordinates;
  const pairs =
    geometry.type === "Polygon"
      ? geometry.coordinates[0] ?? []
      : geometry.type === "MultiPolygon"
        ? geometry.coordinates.flatMap((polygon) => polygon[0] ?? [])
        : allPositions(geometry);
  if (!pairs.length) return null;
  let lng = 0;
  let lat = 0;
  for (const pair of pairs) {
    lng += pair[0];
    lat += pair[1];
  }
  return [lng / pairs.length, lat / pairs.length];
}

export function haversineMeters(a: Pair, b: Pair) {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b[1] - a[1]);
  const dLng = toRad(b[0] - a[0]);
  const lat1 = toRad(a[1]);
  const lat2 = toRad(b[1]);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371000 * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function pointInRing(point: Pair, ring: Pair[]) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i, i += 1) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    const intersect =
      yi > point[1] !== yj > point[1] &&
      point[0] < ((xj - xi) * (point[1] - yi)) / (yj - yi + 0.0) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

export function geometryContains(geometry: RoadEventGeometry, point: Pair) {
  if (geometry.type === "Polygon") return pointInRing(point, geometry.coordinates[0] ?? []);
  if (geometry.type === "MultiPolygon") {
    return geometry.coordinates.some((polygon) => pointInRing(point, polygon[0] ?? []));
  }
  return false;
}

/** Rough extent of the geometry, in metres. Large fences should not swallow nearby events. */
export function bboxDiagonalMeters(geometry: RoadEventGeometry | null) {
  const pairs = allPositions(geometry);
  if (pairs.length < 2) return 0;
  let west = Infinity;
  let east = -Infinity;
  let south = Infinity;
  let north = -Infinity;
  for (const [lng, lat] of pairs) {
    west = Math.min(west, lng);
    east = Math.max(east, lng);
    south = Math.min(south, lat);
    north = Math.max(north, lat);
  }
  return haversineMeters([west, south], [east, north]);
}

function projectTree(node: unknown, zone: number): unknown {
  if (!Array.isArray(node)) return node;
  if (typeof node[0] === "number" && typeof node[1] === "number") {
    return twd97Tm2ToWgs84(node[0], node[1], zone);
  }
  return node.map((child) => projectTree(child, zone));
}

function isPairTree(node: unknown): boolean {
  if (!Array.isArray(node)) return false;
  if (typeof node[0] === "number") return false;
  return node.every((child) => {
    if (!Array.isArray(child)) return false;
    if (typeof child[0] === "number") {
      return child.length >= 2 && Number.isFinite(child[0]) && Number.isFinite(child[1]);
    }
    return isPairTree(child);
  });
}

export function projectGeometry(
  geometry: RoadEventGeometry,
  zone = 121,
): RoadEventGeometry | null {
  const coordinates = projectTree(geometry.coordinates, zone);
  if (!isPairTree(coordinates) && geometry.type !== "Point") return null;
  if (geometry.type === "Point") {
    if (!Array.isArray(coordinates) || typeof coordinates[0] !== "number") return null;
    return { type: "Point", coordinates: coordinates as Pair };
  }
  return { ...geometry, coordinates } as RoadEventGeometry;
}

function typedGeometry(kind: string, positions: unknown): RoadEventGeometry | null {
  const normalized = kind.toLowerCase();
  if (normalized.includes("multipolygon")) {
    return { type: "MultiPolygon", coordinates: positions as [number, number][][][] };
  }
  if (normalized.includes("polygon")) {
    return { type: "Polygon", coordinates: positions as [number, number][][] };
  }
  if (normalized.includes("multilinestring")) {
    return { type: "MultiLineString", coordinates: positions as [number, number][][] };
  }
  if (normalized.includes("linestring")) {
    return { type: "LineString", coordinates: positions as [number, number][] };
  }
  if (normalized.includes("multipoint")) {
    return { type: "MultiPoint", coordinates: positions as [number, number][] };
  }
  if (normalized.includes("point")) {
    return { type: "Point", coordinates: positions as [number, number] };
  }
  return null;
}

export function geometryFromPositions(
  positions: unknown,
  kind: string | null,
  zone: number | null,
): RoadEventGeometry | null {
  if (positions == null || !kind) return null;
  const geometry = typedGeometry(kind, positions);
  if (!geometry) return null;
  const projected = zone == null ? geometry : projectGeometry(geometry, zone);
  if (!projected || !geometryUsable(projected)) return null;
  return projected;
}
