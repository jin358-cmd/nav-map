import type { ExpressionSpecification, Map as MapLibreMap } from "maplibre-gl";

/**
 * Basemap place and road names. Prefer Traditional Chinese, then the local
 * `name`. This drops the latin line OpenFreeMap draws from `name:latin` /
 * `name_en`. Road-number shields (`ref`) are not place names and stay as-is.
 */
export const CHINESE_NAME_TEXT_FIELD: ExpressionSpecification = [
  "coalesce",
  ["get", "name:zh-Hant"],
  ["get", "name:zh-TW"],
  ["get", "name:zh"],
  ["get", "name"],
];

const OWNED_OVERLAY_PREFIXES = [
  "parking-",
  "navpilot-poi",
  "navpilot-turn",
  "speed-enforcement",
  "guidance",
];

export function isOwnedOverlayLayer(layerId: string) {
  return OWNED_OVERLAY_PREFIXES.some(
    (prefix) => layerId === prefix || layerId.startsWith(prefix),
  );
}

export function expressionUsesPlaceName(value: unknown): boolean {
  if (typeof value === "string") {
    return value === "name" || value.startsWith("name:") || value.startsWith("name_");
  }
  if (!Array.isArray(value)) return false;
  return value.some((part) => expressionUsesPlaceName(part));
}

export function shouldRewriteBasemapLabel(layerId: string, textField: unknown) {
  if (isOwnedOverlayLayer(layerId)) return false;
  return expressionUsesPlaceName(textField);
}

let applyingLabels = false;

export function applyChineseBasemapLabels(map: MapLibreMap) {
  if (applyingLabels) return;
  let layers: Array<{ id: string; type?: string }> = [];
  try {
    layers = map.getStyle()?.layers ?? [];
  } catch {
    return;
  }
  applyingLabels = true;
  try {
    for (const layer of layers) {
      if (layer.type !== "symbol") continue;
      let textField: unknown;
      try {
        textField = map.getLayoutProperty(layer.id, "text-field");
      } catch {
        continue;
      }
      if (!shouldRewriteBasemapLabel(layer.id, textField)) continue;
      try {
        map.setLayoutProperty(layer.id, "text-field", CHINESE_NAME_TEXT_FIELD);
        // One Chinese line is shorter than the old latin + local pair, so a
        // little extra padding keeps labels from packing tighter on the map.
        map.setLayoutProperty(layer.id, "text-padding", 10);
      } catch {
        /* a basemap layer may reject text-field; keep the rest */
      }
    }
  } finally {
    applyingLabels = false;
  }
}
