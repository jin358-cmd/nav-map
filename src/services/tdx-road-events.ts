import "server-only";
import { fetchTdxRaw } from "@/services/tdx-client";

/**
 * Official RoadEvent v1 coverage is partial.
 * Scheduled city events omit Kaohsiung and most counties.
 * This adapter only reads Tainan plus highway scheduled events, and only when
 * server credentials already exist. It never synthesizes coordinates.
 */
const ROAD_EVENT_PATHS = [
  "/v1/Traffic/RoadEvent/LiveEvent/City/Tainan",
  "/v1/Traffic/RoadEvent/Event/City/Tainan",
  "/v1/Traffic/RoadEvent/Event/Highway",
] as const;

export async function fetchTdxRoadEventPayloads(): Promise<
  | { ok: true; status: number; bodies: unknown[]; timedOut: false }
  | { ok: false; status: number; bodies: []; timedOut: boolean }
> {
  const bodies: unknown[] = [];
  for (const path of ROAD_EVENT_PATHS) {
    const result = await fetchTdxRaw(path, 20);
    if (!result.ok || result.body == null) {
      return { ok: false, status: result.status, bodies: [], timedOut: result.timedOut };
    }
    bodies.push(result.body);
  }
  return { ok: true, status: 200, bodies, timedOut: false };
}
