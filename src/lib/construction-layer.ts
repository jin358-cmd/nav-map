import type {
  GeoJSONSource,
  Map as MapLibreMap,
  MapLayerMouseEvent,
} from "maplibre-gl";
import type { ConstructionEvent } from "@/types/domain";

export const CONSTRUCTION_SOURCE_ID = "construction-source";
export const CONSTRUCTION_LAYER_ID = "construction-layer";
export const CONSTRUCTION_HIT_LAYER_ID = "construction-hit-layer";
export const CONSTRUCTION_ICON_ID = "construction-barrier-icon";
export const CONSTRUCTION_ICON_ON_ID = "construction-barrier-icon-on";

function data(items: ConstructionEvent[]) {
  return {
    type: "FeatureCollection" as const,
    features: items.map((item) => ({
      type: "Feature" as const,
      id: item.id,
      properties: { id: item.id, title: item.title },
      geometry: {
        type: "Point" as const,
        coordinates: [item.location.lng, item.location.lat],
      },
    })),
  };
}

function drawBarrier(fill: string, selected: boolean): ImageData {
  const size = 64;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) return new ImageData(size, size);
  ctx.fillStyle = fill;
  ctx.fillRect(10, 18, 8, 32);
  ctx.fillRect(46, 18, 8, 32);
  ctx.fillRect(10, 24, 44, 8);
  ctx.fillRect(10, 36, 44, 8);
  ctx.strokeStyle = selected ? "#fff7ed" : "#fde68a";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(18, 24);
  ctx.lineTo(30, 44);
  ctx.moveTo(34, 24);
  ctx.lineTo(46, 44);
  ctx.stroke();
  return ctx.getImageData(0, 0, size, size);
}

function ensureIcons(map: MapLibreMap) {
  if (!map.hasImage(CONSTRUCTION_ICON_ID)) {
    map.addImage(CONSTRUCTION_ICON_ID, drawBarrier("#ca8a04", false));
  }
  if (!map.hasImage(CONSTRUCTION_ICON_ON_ID)) {
    map.addImage(CONSTRUCTION_ICON_ON_ID, drawBarrier("#eab308", true));
  }
}

export function upsertConstructionLayer(
  map: MapLibreMap,
  items: ConstructionEvent[],
  selectedId: string | null,
  visible = true,
) {
  ensureIcons(map);
  const source = map.getSource(CONSTRUCTION_SOURCE_ID);
  if (source?.type === "geojson") (source as GeoJSONSource).setData(data(items));
  else if (!source) {
    map.addSource(CONSTRUCTION_SOURCE_ID, { type: "geojson", data: data(items) });
  }

  if (!map.getLayer(CONSTRUCTION_HIT_LAYER_ID)) {
    map.addLayer({
      id: CONSTRUCTION_HIT_LAYER_ID,
      type: "circle",
      source: CONSTRUCTION_SOURCE_ID,
      paint: { "circle-radius": 22, "circle-opacity": 0 },
    });
  }
  if (!map.getLayer(CONSTRUCTION_LAYER_ID)) {
    map.addLayer({
      id: CONSTRUCTION_LAYER_ID,
      type: "symbol",
      source: CONSTRUCTION_SOURCE_ID,
      layout: {
        "icon-image": [
          "case",
          ["==", ["get", "id"], selectedId ?? ""],
          CONSTRUCTION_ICON_ON_ID,
          CONSTRUCTION_ICON_ID,
        ],
        "icon-size": ["case", ["==", ["get", "id"], selectedId ?? ""], 0.62, 0.48],
        "icon-allow-overlap": true,
        "icon-ignore-placement": true,
      },
    });
  } else {
    map.setLayoutProperty(CONSTRUCTION_LAYER_ID, "icon-image", [
      "case",
      ["==", ["get", "id"], selectedId ?? ""],
      CONSTRUCTION_ICON_ON_ID,
      CONSTRUCTION_ICON_ID,
    ]);
    map.setLayoutProperty(CONSTRUCTION_LAYER_ID, "icon-size", [
      "case",
      ["==", ["get", "id"], selectedId ?? ""],
      0.62,
      0.48,
    ]);
  }
  const visibility = visible ? "visible" : "none";
  if (map.getLayer(CONSTRUCTION_LAYER_ID)) {
    map.setLayoutProperty(CONSTRUCTION_LAYER_ID, "visibility", visibility);
  }
  if (map.getLayer(CONSTRUCTION_HIT_LAYER_ID)) {
    map.setLayoutProperty(CONSTRUCTION_HIT_LAYER_ID, "visibility", visibility);
  }
}

const bound = new WeakSet<MapLibreMap>();
export function bindConstructionLayerClicks(
  map: MapLibreMap,
  select: (id: string) => void,
) {
  if (bound.has(map)) return;
  bound.add(map);
  const handle = (event: MapLayerMouseEvent) => {
    const id = event.features?.[0]?.properties?.id;
    if (typeof id === "string") select(id);
  };
  map.on("click", CONSTRUCTION_LAYER_ID, handle);
  map.on("click", CONSTRUCTION_HIT_LAYER_ID, handle);
  map.on("mouseenter", CONSTRUCTION_HIT_LAYER_ID, () => {
    map.getCanvas().style.cursor = "pointer";
  });
  map.on("mouseleave", CONSTRUCTION_HIT_LAYER_ID, () => {
    map.getCanvas().style.cursor = "";
  });
}
