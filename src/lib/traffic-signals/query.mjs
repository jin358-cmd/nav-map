import { readFileSync } from "node:fs";
import { join } from "node:path";
import { haversineMeters, projectSignal, recordToSignal } from "./project.mjs";

let cached = null;

export function loadSignalCatalog() {
  if (cached) return cached;
  const path = join(process.cwd(), "fixtures", "traffic-signals", "tainan-110-signals.json");
  cached = JSON.parse(readFileSync(path, "utf8"));
  return cached;
}

export function querySignals({ west, south, east, north, zoom, center, limit = 160 }) {
  const catalog = loadSignalCatalog();
  const numericZoom = Number(zoom);
  if (!Number.isFinite(numericZoom) || numericZoom < 14) {
    return {
      origin: "tainan-110-static",
      liveCountdown: "blocked",
      reason: "zoom",
      attribution: catalog.license,
      sourceUrl: catalog.source_url,
      signals: [],
    };
  }
  const bounds = [Number(west), Number(south), Number(east), Number(north)];
  if (bounds.some((value) => !Number.isFinite(value))) {
    return {
      origin: "tainan-110-static",
      liveCountdown: "blocked",
      reason: "bounds",
      attribution: catalog.license,
      sourceUrl: catalog.source_url,
      signals: [],
    };
  }
  const [minLng, minLat, maxLng, maxLat] = bounds;
  const rows = [];
  for (const row of catalog.signals ?? []) {
    const lng = row[0];
    const lat = row[1];
    if (lng < minLng || lng > maxLng || lat < minLat || lat > maxLat) continue;
    const signal = recordToSignal(row);
    if (!signal) continue;
    const view = projectSignal(signal);
    if (!view.drawable || view.seconds != null || view.demo) continue;
    rows.push({ signal, view, distance: center ? haversineMeters(center, signal.location) : 0 });
  }
  rows.sort((a, b) => a.distance - b.distance);
  return {
    origin: "tainan-110-static",
    liveCountdown: "blocked",
    reason: null,
    attribution: `${catalog.dataset}｜${catalog.license}`,
    sourceUrl: catalog.source_url,
    edition: catalog.edition,
    truncated: rows.length > limit,
    signals: rows.slice(0, limit).map((row) => ({ ...row.signal, presentation: row.view })),
  };
}
