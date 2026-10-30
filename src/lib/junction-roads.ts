import type { Map as MapLibreMap } from "maplibre-gl";

const ROAD_NAME = /highway|road|transport/i;

export type RoadSketch = {
  line: [number, number][];
  name: string;
  rank?: "major" | "minor";
};

function pushLine(
  lines: RoadSketch[],
  seen: Set<string>,
  coordinates: number[][],
  name: string,
  rank: "major" | "minor",
) {
  if (coordinates.length < 2) return;
  const first = coordinates[0];
  const last = coordinates[coordinates.length - 1];
  if (first == null || last == null || first.length < 2 || last.length < 2) return;
  const key = `${first[0].toFixed(5)},${first[1].toFixed(5)}:${last[0].toFixed(5)},${last[1].toFixed(5)}:${coordinates.length}`;
  if (seen.has(key)) return;
  seen.add(key);
  lines.push({
    line: coordinates.map((pair) => [pair[0], pair[1]] as [number, number]),
    name,
    rank,
  });
}

/** Road centrelines already on the main map, around the maneuver. Empty on raster styles. */
export function nearbyRoadSketches(
  map: MapLibreMap,
  center: { lng: number; lat: number },
  pixelRadius = 120,
): RoadSketch[] {
  if (!map.isStyleLoaded()) return [];
  let point: { x: number; y: number };
  try {
    point = map.project([center.lng, center.lat]);
  } catch {
    return [];
  }
  let features: ReturnType<MapLibreMap["queryRenderedFeatures"]> = [];
  try {
    features = map.queryRenderedFeatures([
      [point.x - pixelRadius, point.y - pixelRadius],
      [point.x + pixelRadius, point.y + pixelRadius],
    ]);
  } catch {
    return [];
  }
  const lines: RoadSketch[] = [];
  const seen = new Set<string>();
  for (const feature of features) {
    const layerId = feature.layer?.id ?? "";
    const sourceLayer = feature.sourceLayer ?? "";
    if (!ROAD_NAME.test(layerId) && !ROAD_NAME.test(sourceLayer)) continue;
    const geometry = feature.geometry;
    if (!geometry) continue;
    const props = feature.properties ?? {};
    const name = String(
      props["name:zh-Hant"] || props["name:zh"] || props.name || props.ref || "",
    ).trim();
    const rank = /motorway|trunk|primary|major/i.test(`${layerId} ${sourceLayer}`)
      ? "major"
      : "minor";
    if (geometry.type === "LineString") pushLine(lines, seen, geometry.coordinates, name, rank);
    if (geometry.type === "MultiLineString") {
      for (const line of geometry.coordinates) pushLine(lines, seen, line, name, rank);
    }
    if (lines.length >= 16) break;
  }
  return lines;
}

/** Building footprints near the junction. Empty when the style has no building layer. */
export function nearbyBlockRings(
  map: MapLibreMap,
  center: { lng: number; lat: number },
  pixelRadius = 120,
): [number, number][][] {
  if (!map.isStyleLoaded()) return [];
  let point: { x: number; y: number };
  try {
    point = map.project([center.lng, center.lat]);
  } catch {
    return [];
  }
  let features: ReturnType<MapLibreMap["queryRenderedFeatures"]> = [];
  try {
    features = map.queryRenderedFeatures([
      [point.x - pixelRadius, point.y - pixelRadius],
      [point.x + pixelRadius, point.y + pixelRadius],
    ]);
  } catch {
    return [];
  }
  const rings: [number, number][][] = [];
  for (const feature of features) {
    const layerId = feature.layer?.id ?? "";
    const sourceLayer = feature.sourceLayer ?? "";
    if (!/building/i.test(layerId) && !/building/i.test(sourceLayer)) continue;
    const geometry = feature.geometry;
    if (!geometry) continue;
    if (geometry.type === "Polygon") {
      const ring = geometry.coordinates[0];
      if (ring && ring.length >= 4) {
        rings.push(ring.map((pair) => [pair[0], pair[1]] as [number, number]));
      }
    }
    if (geometry.type === "MultiPolygon") {
      for (const polygon of geometry.coordinates) {
        const ring = polygon[0];
        if (ring && ring.length >= 4) {
          rings.push(ring.map((pair) => [pair[0], pair[1]] as [number, number]));
        }
      }
    }
    if (rings.length >= 8) break;
  }
  return rings;
}

export function nearbyRoadLines(
  map: MapLibreMap,
  center: { lng: number; lat: number },
  pixelRadius = 120,
): [number, number][][] {
  return nearbyRoadSketches(map, center, pixelRadius).map((road) => road.line);
}
