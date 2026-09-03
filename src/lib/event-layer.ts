import type {
  GeoJSONSource,
  Map as MapLibreMap,
  MapLayerMouseEvent,
} from "maplibre-gl";
import type { AccidentReport } from "@/types/domain";

export const ACCIDENT_SOURCE_ID = "accident-source";
export const ACCIDENT_LAYER_ID = "accident-layer";
export const ACCIDENT_HIT_LAYER_ID = "accident-hit-layer";
export const ACCIDENT_ICON_ID = "accident-triangle-icon";
export const ACCIDENT_ICON_ON_ID = "accident-triangle-icon-on";

function data(accidents: AccidentReport[]) {
  return {
    type: "FeatureCollection" as const,
    features: accidents.map((item) => ({
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

function drawTriangle(fill: string, selected: boolean): ImageData {
  const size = 64;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) return new ImageData(size, size);
  ctx.beginPath();
  ctx.moveTo(32, 6);
  ctx.lineTo(58, 54);
  ctx.lineTo(6, 54);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.lineWidth = selected ? 5 : 3;
  ctx.strokeStyle = "#fff7ed";
  ctx.stroke();
  ctx.fillStyle = "#fff7ed";
  ctx.fillRect(30, 22, 4, 16);
  ctx.beginPath();
  ctx.arc(32, 44, 2.4, 0, Math.PI * 2);
  ctx.fill();
  return ctx.getImageData(0, 0, size, size);
}

function ensureIcons(map: MapLibreMap) {
  if (!map.hasImage(ACCIDENT_ICON_ID)) {
    map.addImage(ACCIDENT_ICON_ID, drawTriangle("#dc2626", false));
  }
  if (!map.hasImage(ACCIDENT_ICON_ON_ID)) {
    map.addImage(ACCIDENT_ICON_ON_ID, drawTriangle("#ef4444", true));
  }
}

export function upsertAccidentLayer(
  map: MapLibreMap,
  accidents: AccidentReport[],
  selectedId: string | null,
  visible = true,
) {
  ensureIcons(map);
  const source = map.getSource(ACCIDENT_SOURCE_ID);
  if (source?.type === "geojson") (source as GeoJSONSource).setData(data(accidents));
  else if (!source) map.addSource(ACCIDENT_SOURCE_ID, { type: "geojson", data: data(accidents) });

  if (!map.getLayer(ACCIDENT_HIT_LAYER_ID)) {
    map.addLayer({
      id: ACCIDENT_HIT_LAYER_ID,
      type: "circle",
      source: ACCIDENT_SOURCE_ID,
      paint: { "circle-radius": 22, "circle-opacity": 0 },
    });
  }
  if (!map.getLayer(ACCIDENT_LAYER_ID)) {
    map.addLayer({
      id: ACCIDENT_LAYER_ID,
      type: "symbol",
      source: ACCIDENT_SOURCE_ID,
      layout: {
        "icon-image": [
          "case",
          ["==", ["get", "id"], selectedId ?? ""],
          ACCIDENT_ICON_ON_ID,
          ACCIDENT_ICON_ID,
        ],
        "icon-size": ["case", ["==", ["get", "id"], selectedId ?? ""], 0.62, 0.48],
        "icon-allow-overlap": true,
        "icon-ignore-placement": true,
      },
    });
  } else {
    map.setLayoutProperty(ACCIDENT_LAYER_ID, "icon-image", [
      "case",
      ["==", ["get", "id"], selectedId ?? ""],
      ACCIDENT_ICON_ON_ID,
      ACCIDENT_ICON_ID,
    ]);
    map.setLayoutProperty(ACCIDENT_LAYER_ID, "icon-size", [
      "case",
      ["==", ["get", "id"], selectedId ?? ""],
      0.62,
      0.48,
    ]);
  }
  const visibility = visible ? "visible" : "none";
  if (map.getLayer(ACCIDENT_LAYER_ID)) {
    map.setLayoutProperty(ACCIDENT_LAYER_ID, "visibility", visibility);
  }
  if (map.getLayer(ACCIDENT_HIT_LAYER_ID)) {
    map.setLayoutProperty(ACCIDENT_HIT_LAYER_ID, "visibility", visibility);
  }
}

const bound = new WeakSet<MapLibreMap>();
export function bindAccidentLayerClicks(
  map: MapLibreMap,
  select: (id: string) => void,
) {
  if (bound.has(map)) return;
  bound.add(map);
  map.on("click", ACCIDENT_HIT_LAYER_ID, (event: MapLayerMouseEvent) => {
    const id = event.features?.[0]?.properties?.id;
    if (typeof id === "string") select(id);
  });
  map.on("click", ACCIDENT_LAYER_ID, (event: MapLayerMouseEvent) => {
    const id = event.features?.[0]?.properties?.id;
    if (typeof id === "string") select(id);
  });
  map.on("mouseenter", ACCIDENT_HIT_LAYER_ID, () => {
    map.getCanvas().style.cursor = "pointer";
  });
  map.on("mouseleave", ACCIDENT_HIT_LAYER_ID, () => {
    map.getCanvas().style.cursor = "";
  });
}
