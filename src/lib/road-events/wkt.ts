import type { RoadEventGeometry } from "./types";

type Pair = [number, number];

function parsePairList(body: string): Pair[] | null {
  const parts = body
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
  if (!parts.length) return null;
  const pairs: Pair[] = [];
  for (const part of parts) {
    const nums = part.split(/\s+/).map(Number);
    if (nums.length < 2 || !Number.isFinite(nums[0]) || !Number.isFinite(nums[1])) {
      return null;
    }
    pairs.push([nums[0], nums[1]]);
  }
  return pairs;
}

/** Split a WKT body into top-level parenthesized groups, returning their inner text. */
function splitGroups(body: string): string[] {
  const groups: string[] = [];
  let depth = 0;
  let start = -1;
  for (let i = 0; i < body.length; i += 1) {
    const ch = body[i];
    if (ch === "(") {
      if (depth === 0) start = i + 1;
      depth += 1;
    } else if (ch === ")") {
      depth -= 1;
      if (depth === 0 && start >= 0) {
        groups.push(body.slice(start, i));
        start = -1;
      }
      if (depth < 0) return [];
    }
  }
  return groups;
}

function asLine(pairs: Pair[] | null): Pair[] | null {
  if (!pairs || pairs.length < 2) return null;
  return pairs;
}

function asRing(pairs: Pair[] | null): Pair[] | null {
  if (!pairs || pairs.length < 3) return null;
  return pairs;
}

/**
 * Parse POINT, LINESTRING, and POLYGON, including a space before the parenthesis
 * (`POINT (121 25)`) and POLYGON rings (`POLYGON ((121 25, ...))`).
 * Also accepts MULTILINESTRING and MULTIPOLYGON.
 */
export function parseWkt(value: string): RoadEventGeometry | null {
  const text = value.trim();
  const head = /^(MULTI)?(POINT|LINESTRING|POLYGON)\s*Z?\s*/i.exec(text);
  if (!head) return null;
  const multi = Boolean(head[1]);
  const kind = head[2].toUpperCase();
  const rest = text.slice(head[0].length).trim();
  if (!rest.startsWith("(") || !rest.endsWith(")")) return null;
  const body = rest.slice(1, -1).trim();

  if (!multi && kind === "POINT") {
    const pairs = parsePairList(body);
    if (!pairs || pairs.length !== 1) return null;
    return { type: "Point", coordinates: pairs[0] };
  }
  if (!multi && kind === "LINESTRING") {
    const pairs = asLine(parsePairList(body));
    if (!pairs) return null;
    return { type: "LineString", coordinates: pairs };
  }
  if (!multi && kind === "POLYGON") {
    const rings = splitGroups(body)
      .map((ring) => asRing(parsePairList(ring)))
      .filter((ring): ring is Pair[] => Boolean(ring));
    if (!rings.length) return null;
    return { type: "Polygon", coordinates: rings };
  }
  if (multi && kind === "LINESTRING") {
    const lines = splitGroups(body)
      .map((line) => asLine(parsePairList(line)))
      .filter((line): line is Pair[] => Boolean(line));
    if (!lines.length) return null;
    return { type: "MultiLineString", coordinates: lines };
  }
  if (multi && kind === "POLYGON") {
    const polygons = splitGroups(body)
      .map((poly) =>
        splitGroups(poly)
          .map((ring) => asRing(parsePairList(ring)))
          .filter((ring): ring is Pair[] => Boolean(ring)),
      )
      .filter((rings) => rings.length > 0);
    if (!polygons.length) return null;
    return { type: "MultiPolygon", coordinates: polygons };
  }
  return null;
}
