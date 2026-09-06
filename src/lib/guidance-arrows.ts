import type { Map as MapLibreMap } from "maplibre-gl";

const SOURCE_ID = "navpilot-guidance-arrows";
const LAYER_ID = "navpilot-guidance-arrows-layer";
const CHEVRON_ID = "navpilot-guidance-chevron";
const HIGHLIGHT_SOURCE_ID = "navpilot-guidance-highlight";
const HIGHLIGHT_GLOW_ID = "navpilot-guidance-highlight-glow";
const HIGHLIGHT_CORE_ID = "navpilot-guidance-highlight-core";

export function clearGuidanceArrows(map: MapLibreMap) {
  for (const id of [HIGHLIGHT_GLOW_ID, HIGHLIGHT_CORE_ID, LAYER_ID]) {
    if (map.getLayer(id)) {
      map.removeLayer(id);
    }
  }
  for (const id of [HIGHLIGHT_SOURCE_ID, SOURCE_ID]) {
    if (map.getSource(id)) {
      map.removeSource(id);
    }
  }
  if (map.hasImage(CHEVRON_ID)) {
    map.removeImage(CHEVRON_ID);
  }
}

export function resetGuidanceArrowCache() {
  /* Intersection turn arrows are disabled. */
}

/** Intersection turn arrows are disabled; leftover layers are cleared if present. */
export function upsertGuidanceArrows(map: MapLibreMap) {
  if (!map.isStyleLoaded()) {
    return;
  }
  clearGuidanceArrows(map);
}
