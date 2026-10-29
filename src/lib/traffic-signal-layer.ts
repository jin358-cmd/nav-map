import type { GeoJSONSource, Map as MapLibreMap, MapLayerMouseEvent } from "maplibre-gl";

export const SIGNAL_SOURCE_ID = "traffic-signal-source";
export const SIGNAL_LAYER_ID = "traffic-signal-layer";
export const SIGNAL_ICON_ID = "traffic-signal-neutral";
export const SIGNAL_ICON_ON_ID = "traffic-signal-neutral-on";

export type MapSignal = {
  intersectionId: string;
  presentation?: { label?: string | null; showColor?: boolean; seconds?: number | null };
  location: { lng: number; lat: number };
};

function drawNeutral(selected: boolean): ImageData {
  const size = 64;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) return new ImageData(size, size);
  ctx.clearRect(0, 0, size, size);
  ctx.beginPath();
  if (typeof ctx.roundRect === "function") ctx.roundRect(6, 8, 52, 48, 14);
  else ctx.rect(6, 8, 52, 48);
  ctx.fillStyle = selected ? "#f4f4f5" : "#d4d4d8";
  ctx.fill();
  ctx.lineWidth = 4;
  ctx.strokeStyle = "#27272a";
  ctx.stroke();
  ctx.fillStyle = "#18181b";
  ctx.font = "700 22px sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("--", 32, 33);
  return ctx.getImageData(0, 0, size, size);
}

function ensureIcons(map: MapLibreMap) {
  if (!map.hasImage(SIGNAL_ICON_ID)) map.addImage(SIGNAL_ICON_ID, drawNeutral(false), { pixelRatio: 2 });
  if (!map.hasImage(SIGNAL_ICON_ON_ID)) map.addImage(SIGNAL_ICON_ON_ID, drawNeutral(true), { pixelRatio: 2 });
}

function data(signals: MapSignal[], selectedId: string | null) {
  return {
    type: "FeatureCollection" as const,
    features: signals
      .filter((signal) => signal.presentation?.showColor !== true && signal.presentation?.seconds == null)
      .map((signal) => ({
        type: "Feature" as const,
        id: signal.intersectionId,
        properties: {
          id: signal.intersectionId,
          icon: signal.intersectionId === selectedId ? SIGNAL_ICON_ON_ID : SIGNAL_ICON_ID,
          label: "--",
        },
        geometry: {
          type: "Point" as const,
          coordinates: [signal.location.lng, signal.location.lat],
        },
      })),
  };
}

export function upsertTrafficSignalLayer(
  map: MapLibreMap,
  signals: MapSignal[],
  selectedId: string | null,
  visible = true,
) {
  ensureIcons(map);
  const collection = data(visible ? signals : [], selectedId);
  const source = map.getSource(SIGNAL_SOURCE_ID);
  if (source?.type === "geojson") (source as GeoJSONSource).setData(collection);
  else if (!source) map.addSource(SIGNAL_SOURCE_ID, { type: "geojson", data: collection });
  if (map.getLayer("traffic-signal-circle")) map.removeLayer("traffic-signal-circle");
  if (!map.getLayer(SIGNAL_LAYER_ID)) {
    map.addLayer({
      id: SIGNAL_LAYER_ID,
      type: "symbol",
      source: SIGNAL_SOURCE_ID,
      layout: {
        "icon-image": ["get", "icon"],
        "icon-size": 0.82,
        "icon-allow-overlap": true,
        "icon-ignore-placement": true,
        "icon-pitch-alignment": "viewport",
        "icon-rotation-alignment": "viewport",
      },
    });
  }
  if (map.getLayer(SIGNAL_LAYER_ID)) map.moveLayer(SIGNAL_LAYER_ID);
}

const bound = new WeakSet<MapLibreMap>();

export function bindTrafficSignalClicks(map: MapLibreMap, select: (id: string) => void) {
  if (bound.has(map)) return;
  bound.add(map);
  map.on("mouseenter", SIGNAL_LAYER_ID, () => {
    map.getCanvas().style.cursor = "pointer";
  });
  map.on("mouseleave", SIGNAL_LAYER_ID, () => {
    map.getCanvas().style.cursor = "";
  });
  map.on("click", SIGNAL_LAYER_ID, (event: MapLayerMouseEvent) => {
    const id = event.features?.[0]?.properties?.id;
    if (typeof id === "string") select(id);
  });
}
