import type { Map as MapLibreMap } from "maplibre-gl";

const ROAD_NAME = /highway|road|transport/i;

export type RoadSketch = {
  line: [number, number][];
  name: string;
};

function pushLine(
  lines: RoadSketch[],
  seen: Set<string>,
  coordinates: number[][],
  name: string,
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
    if (geometry.type === "LineString") pushLine(lines, seen, geometry.coordinates, name);
    if (geometry.type === "MultiLineString") {
      for (const line of geometry.coordinates) pushLine(lines, seen, line, name);
    }
    if (lines.length >= 10) break;
  }
  return lines;
}

export function nearbyRoadLines(
  map: MapLibreMap,
  center: { lng: number; lat: number },
  pixelRadius = 120,
): [number, number][][] {
  return nearbyRoadSketches(map, center, pixelRadius).map((road) => road.line);
}
