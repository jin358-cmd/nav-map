/**
 * Parse TDX SectionShape WKT into a single [lng, lat] line.
 * MULTILINESTRING keeps the longest ring.
 */
export function parseWktLine(wkt: string): [number, number][] | null {
  const text = wkt.trim();
  if (!text) return null;

  const multi = /^MULTILINESTRING\s*Z?\s*\(/i.exec(text);
  if (multi) {
    const body = unwrapOuter(text.slice(multi[0].length - 1));
    const rings = splitWktRings(body)
      .map(parseCoordList)
      .filter((ring): ring is [number, number][] => Boolean(ring));
    if (!rings.length) return null;
    return rings.reduce((longest, ring) =>
      ring.length > longest.length ? ring : longest,
    );
  }

  const line = /^LINESTRING\s*Z?\s*\(/i.exec(text);
  if (line) {
    const body = unwrapOuter(text.slice(line[0].length - 1));
    return parseCoordList(body);
  }

  return null;
}

function unwrapOuter(text: string): string {
  const trimmed = text.trim();
  if (trimmed.startsWith("(") && trimmed.endsWith(")")) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

function splitWktRings(body: string): string[] {
  const rings: string[] = [];
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
        rings.push(body.slice(start, i));
        start = -1;
      }
    }
  }
  if (!rings.length && body.trim()) rings.push(body);
  return rings;
}

function parseCoordList(inner: string): [number, number][] | null {
  const points = inner
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
  const coords: [number, number][] = [];
  for (const point of points) {
    const parts = point.split(/\s+/).map(Number);
    if (
      parts.length < 2 ||
      !Number.isFinite(parts[0]) ||
      !Number.isFinite(parts[1])
    ) {
      continue;
    }
    coords.push([parts[0], parts[1]]);
  }
  return coords.length >= 2 ? coords : null;
}
