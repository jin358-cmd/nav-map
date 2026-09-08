import type {
  GeoJSONSource,
  Map as MapLibreMap,
  MapLayerMouseEvent,
} from "maplibre-gl";
import type { MapPoiFeature } from "@/lib/map-place";
import {
  POI_LAYER_COLORS,
  POI_MAIN_LAYER_IDS,
  poiMainLayerFromCategory,
  type PoiMainLayerId,
} from "@/lib/poi/main-layers";

export const POI_SOURCE_ID = "navpilot-poi-source";
export const POI_LAYER_ID = "navpilot-poi-layer";
export const POI_LABEL_LAYER_ID = "navpilot-poi-label";
export const POI_HIT_LAYER_ID = "navpilot-poi-hit";

function circleLayerId(id: PoiMainLayerId) {
  return `${POI_LAYER_ID}-${id}`;
}

function labelLayerId(id: PoiMainLayerId) {
  return `${POI_LABEL_LAYER_ID}-${id}`;
}

function hitLayerId(id: PoiMainLayerId) {
  return `${POI_HIT_LAYER_ID}-${id}`;
}

function featureMainLayer(poi: MapPoiFeature): PoiMainLayerId {
  return poi.mainLayer ?? poiMainLayerFromCategory(poi.category, poi.subcategory);
}

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
        mainLayer: featureMainLayer(poi),
        address: poi.address,
      },
      geometry: {
        type: "Point" as const,
        coordinates: [poi.location.lng, poi.location.lat],
      },
    })),
  };
}

function removeLegacyLayers(map: MapLibreMap) {
  for (const id of [POI_HIT_LAYER_ID, POI_LABEL_LAYER_ID, POI_LAYER_ID]) {
    if (map.getLayer(id)) map.removeLayer(id);
  }
}

export function upsertPoiLayer(map: MapLibreMap, pois: MapPoiFeature[]) {
  const data = collection(pois);
  const source = map.getSource(POI_SOURCE_ID);
  if (source?.type === "geojson") {
    (source as GeoJSONSource).setData(data);
  } else if (!source) {
    map.addSource(POI_SOURCE_ID, { type: "geojson", data });
  }

  removeLegacyLayers(map);

  for (const layer of POI_MAIN_LAYER_IDS) {
    const circleId = circleLayerId(layer);
    const labelId = labelLayerId(layer);
    const hitId = hitLayerId(layer);
    if (!map.getLayer(circleId)) {
      map.addLayer({
        id: circleId,
        type: "circle",
        source: POI_SOURCE_ID,
        minzoom: 10,
        filter: ["==", ["get", "mainLayer"], layer],
        paint: {
          "circle-radius": ["interpolate", ["linear"], ["zoom"], 10, 4.8, 16.5, 8.8],
          "circle-color": POI_LAYER_COLORS[layer],
          "circle-stroke-color": "#f8fafc",
          "circle-stroke-width": 1.35,
          "circle-opacity": 0.96,
        },
      });
    }
    if (!map.getLayer(labelId)) {
      map.addLayer({
        id: labelId,
        type: "symbol",
        source: POI_SOURCE_ID,
        minzoom: 15.2,
        filter: ["==", ["get", "mainLayer"], layer],
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
    if (!map.getLayer(hitId)) {
      map.addLayer({
        id: hitId,
        type: "circle",
        source: POI_SOURCE_ID,
        minzoom: 10,
        filter: ["==", ["get", "mainLayer"], layer],
        paint: {
          "circle-radius": 18,
          "circle-opacity": 0,
        },
      });
    }
    if (map.getLayer(circleId)) map.setLayerZoomRange(circleId, 10, 24);
    if (map.getLayer(hitId)) map.setLayerZoomRange(hitId, 10, 24);
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
  for (const layer of POI_MAIN_LAYER_IDS) {
    map.on("click", circleLayerId(layer), handle);
    map.on("click", hitLayerId(layer), handle);
    map.on("mouseenter", hitLayerId(layer), () => {
      map.getCanvas().style.cursor = "pointer";
    });
    map.on("mouseleave", hitLayerId(layer), () => {
      map.getCanvas().style.cursor = "";
    });
  }
}
