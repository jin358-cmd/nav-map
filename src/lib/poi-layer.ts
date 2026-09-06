import type {
  ExpressionSpecification,
  GeoJSONSource,
  Map as MapLibreMap,
  MapLayerMouseEvent,
} from "maplibre-gl";
import type { MapPoiFeature } from "@/lib/map-place";

export const POI_SOURCE_ID = "navpilot-poi-source";
export const POI_LAYER_ID = "navpilot-poi-layer";
export const POI_LABEL_LAYER_ID = "navpilot-poi-label";
export const POI_HIT_LAYER_ID = "navpilot-poi-hit";

const CATEGORY_COLOR: ExpressionSpecification = [
  "match",
  ["get", "category"],
  "convenience",
  "#22c55e",
  "cafe",
  "#fb7185",
  "restaurant",
  "#f97316",
  "fuel",
  "#38bdf8",
  "parking",
  "#14b8a6",
  "hospital",
  "#ef4444",
  "pharmacy",
  "#a78bfa",
  "landmark",
  "#facc15",
  "#94a3b8",
];

function collection(pois: MapPoiFeature[]) {
  return {
    type: "FeatureCollection" as const,
    features: pois.map((poi) => ({
      type: "Feature" as const,
      id: poi.id,
      properties: {
        id: poi.id,
        name: poi.name,
        category: poi.category,
        address: poi.address,
      },
      geometry: {
        type: "Point" as const,
        coordinates: [poi.location.lng, poi.location.lat],
      },
    })),
  };
}

export function upsertPoiLayer(map: MapLibreMap, pois: MapPoiFeature[]) {
  const data = collection(pois);
  const source = map.getSource(POI_SOURCE_ID);
  if (source?.type === "geojson") {
    (source as GeoJSONSource).setData(data);
  } else if (!source) {
    map.addSource(POI_SOURCE_ID, { type: "geojson", data });
  }

  if (!map.getLayer(POI_LAYER_ID)) {
    map.addLayer({
      id: POI_LAYER_ID,
      type: "circle",
      source: POI_SOURCE_ID,
      minzoom: 13.4,
      paint: {
        "circle-radius": ["interpolate", ["linear"], ["zoom"], 14, 4.2, 17, 6.4],
        "circle-color": CATEGORY_COLOR,
        "circle-stroke-color": "#f8fafc",
        "circle-stroke-width": 1.2,
        "circle-opacity": 0.92,
      },
    });
  }
  if (!map.getLayer(POI_LABEL_LAYER_ID)) {
    map.addLayer({
      id: POI_LABEL_LAYER_ID,
      type: "symbol",
      source: POI_SOURCE_ID,
      minzoom: 15.6,
      layout: {
        "text-field": ["get", "name"],
        "text-size": 11,
        "text-offset": [0, 1.05],
        "text-anchor": "top",
        "text-max-width": 8,
        "text-optional": true,
      },
      paint: {
        "text-color": "#f8fafc",
        "text-halo-color": "rgba(15,23,42,0.78)",
        "text-halo-width": 1.1,
      },
    });
  }
  if (!map.getLayer(POI_HIT_LAYER_ID)) {
    map.addLayer({
      id: POI_HIT_LAYER_ID,
      type: "circle",
      source: POI_SOURCE_ID,
      minzoom: 13.4,
      paint: {
        "circle-radius": 18,
        "circle-opacity": 0,
      },
    });
  }
}

const bound = new WeakSet<MapLibreMap>();

export function bindPoiLayerClicks(
  map: MapLibreMap,
  onSelect: (poiId: string) => void,
) {
  if (bound.has(map)) return;
  bound.add(map);
  const handle = (event: MapLayerMouseEvent) => {
    const id = event.features?.[0]?.properties?.id;
    if (typeof id === "string") onSelect(id);
  };
  map.on("click", POI_LAYER_ID, handle);
  map.on("click", POI_HIT_LAYER_ID, handle);
  map.on("mouseenter", POI_HIT_LAYER_ID, () => {
    map.getCanvas().style.cursor = "pointer";
  });
  map.on("mouseleave", POI_HIT_LAYER_ID, () => {
    map.getCanvas().style.cursor = "";
  });
}
