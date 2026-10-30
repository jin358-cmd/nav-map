import { dedupeOpenDataAgainstTdx } from "./dedupe";
import type { NormalizedRoadEvent, SourceNormalizeResult } from "./types";

export type RoadEventCatalog = {
  sources: SourceNormalizeResult[];
  events: NormalizedRoadEvent[];
  dedupedCount: number;
};

export function buildRoadEventCatalog(sources: SourceNormalizeResult[]): RoadEventCatalog {
  const active = sources.flatMap((source) => (source.ok ? source.events : []));
  const deduped = dedupeOpenDataAgainstTdx(active);
  return {
    sources,
    events: deduped.events,
    dedupedCount: deduped.removed,
  };
}
