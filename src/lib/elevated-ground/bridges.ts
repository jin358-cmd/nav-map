import type { RoadRibbon } from "@/lib/elevated-ground/types";

const DRIVABLE = new Set([
  "motorway",
  "trunk",
  "primary",
  "secondary",
  "tertiary",
  "minor",
  "street",
]);

function numericLayer(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "" && Number.isFinite(Number(value))) {
    return Number(value);
  }
  return null;
}

function asLine(coordinates: unknown): [number, number][] | null {
  if (!Array.isArray(coordinates) || coordinates.length < 2) return null;
  const line: [number, number][] = [];
  for (const pair of coordinates) {
    if (!Array.isArray(pair) || pair.length < 2) return null;
    const lng = Number(pair[0]);
    const lat = Number(pair[1]);
    if (!Number.isFinite(lng) || !Number.isFinite(lat)) return null;
    line.push([lng, lat]);
  }
  return line.length >= 2 ? line : null;
}

export function collectRoadRibbons(
  features: Iterable<{
    properties?: object | null;
    geometry?: { type?: string; coordinates?: unknown } | null;
  }>,
): RoadRibbon[] {
  const ribbons: RoadRibbon[] = [];
  const seen = new Set<string>();
  for (const feature of features) {
    const properties = feature.properties;
    const record =
      properties && typeof properties === "object"
        ? (properties as Record<string, unknown>)
        : null;
    for (const ribbon of roadRibbonsFromProperties(record, feature.geometry)) {
      const start = ribbon.line[0];
      const key = `${ribbon.roadClass}:${ribbon.elevated ? 1 : 0}:${start[0].toFixed(5)},${start[1].toFixed(5)}:${ribbon.line.length}`;
      if (seen.has(key)) continue;
      seen.add(key);
      ribbons.push(ribbon);
      if (ribbons.length >= 500) return ribbons;
    }
  }
  return ribbons;
}

export function roadRibbonsFromProperties(
  properties: Record<string, unknown> | null | undefined,
  geometry: { type?: string; coordinates?: unknown } | null | undefined,
): RoadRibbon[] {
  if (!properties || !geometry) return [];
  const roadClass = String(properties.class ?? "");
  if (!DRIVABLE.has(roadClass)) return [];
  const layer = numericLayer(properties.layer);
  const elevated = properties.brunnel === "bridge" || (layer != null && layer > 0);
  const highway = String(properties.highway ?? properties.subclass ?? "");
  const link = properties.ramp === 1 || properties.ramp === "1" || /_link$/.test(highway);
  const base = { elevated, link, roadClass };
  if (geometry.type === "LineString") {
    const line = asLine(geometry.coordinates);
    return line ? [{ ...base, line }] : [];
  }
  if (geometry.type === "MultiLineString" && Array.isArray(geometry.coordinates)) {
    return geometry.coordinates.flatMap((coordinates) => {
      const line = asLine(coordinates);
      return line ? [{ ...base, line }] : [];
    });
  }
  return [];
}
