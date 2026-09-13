import type {
  FilterSpecification,
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
export const POI_CLUSTER_LAYER_ID = "navpilot-poi-cluster";
export const POI_CLUSTER_COUNT_LAYER_ID = "navpilot-poi-cluster-count";

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

export function poiInteractiveLayerIds() {
  return [
    POI_CLUSTER_LAYER_ID,
    ...POI_MAIN_LAYER_IDS.flatMap((id) => [circleLayerId(id), hitLayerId(id)]),
  ];
}

export function isPoiMapLayer(layerId: string) {
  return (
    layerId === POI_LAYER_ID ||
    layerId === POI_HIT_LAYER_ID ||
    layerId === POI_CLUSTER_LAYER_ID ||
    layerId.startsWith(`${POI_LAYER_ID}-`) ||
    layerId.startsWith(`${POI_HIT_LAYER_ID}-`)
  );
}

function collection(pois: MapPoiFeature[]) {
  return {
    type: "FeatureCollection" as const,
    features: pois.map((poi) => ({
      type: "Feature" as const,
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

function removeLayer(map: MapLibreMap, id: string) {
  if (map.getLayer(id)) map.removeLayer(id);
}

function removeAllPoiLayers(map: MapLibreMap) {
  for (const id of [
    POI_HIT_LAYER_ID,
    POI_LABEL_LAYER_ID,
    POI_LAYER_ID,
    POI_CLUSTER_COUNT_LAYER_ID,
    POI_CLUSTER_LAYER_ID,
  ]) {
    removeLayer(map, id);
  }
  for (const layer of POI_MAIN_LAYER_IDS) {
    removeLayer(map, hitLayerId(layer));
    removeLayer(map, labelLayerId(layer));
    removeLayer(map, circleLayerId(layer));
  }
}

function ensureClusterSource(map: MapLibreMap, data: ReturnType<typeof collection>) {
  const spec = map.getStyle()?.sources?.[POI_SOURCE_ID];
  const clustered = Boolean(spec && "cluster" in spec && spec.cluster);
  const source = map.getSource(POI_SOURCE_ID) as GeoJSONSource | undefined;
  if (source?.type === "geojson" && clustered) {
    source.setData(data);
    return;
  }
  if (source) {
    removeAllPoiLayers(map);
    map.removeSource(POI_SOURCE_ID);
  }
  map.addSource(POI_SOURCE_ID, {
    type: "geojson",
    data,
    cluster: true,
    clusterMaxZoom: 14,
    clusterRadius: 56,
  });
}

export function upsertPoiLayer(map: MapLibreMap, pois: MapPoiFeature[]) {
  const data = collection(pois);
  ensureClusterSource(map, data);

  if (!map.getLayer(POI_CLUSTER_LAYER_ID)) {
    map.addLayer({
      id: POI_CLUSTER_LAYER_ID,
      type: "circle",
      source: POI_SOURCE_ID,
      filter: ["has", "point_count"],
      paint: {
        "circle-color": "#22d3ee",
        "circle-radius": ["step", ["get", "point_count"], 16, 20, 20, 80, 26],
        "circle-opacity": 0.92,
        "circle-stroke-color": "#ecfeff",
        "circle-stroke-width": 1.4,
      },
    });
  }
  if (!map.getLayer(POI_CLUSTER_COUNT_LAYER_ID)) {
    map.addLayer({
      id: POI_CLUSTER_COUNT_LAYER_ID,
      type: "symbol",
      source: POI_SOURCE_ID,
      filter: ["has", "point_count"],
      layout: {
        "text-field": ["get", "point_count_abbreviated"],
        "text-size": 12,
      },
      paint: {
        "text-color": "#042f2e",
      },
    });
  }

  for (const layer of POI_MAIN_LAYER_IDS) {
    const circleId = circleLayerId(layer);
    const labelId = labelLayerId(layer);
    const hitId = hitLayerId(layer);
    const unclustered: FilterSpecification = [
      "all",
      ["!", ["has", "point_count"]],
      ["==", ["get", "mainLayer"], layer],
    ];
    if (!map.getLayer(circleId)) {
      map.addLayer({
        id: circleId,
        type: "circle",
        source: POI_SOURCE_ID,
        minzoom: 10,
        filter: unclustered,
        paint: {
          "circle-radius": ["interpolate", ["linear"], ["zoom"], 10, 5.4, 16.5, 9.2],
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
        filter: unclustered,
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
        filter: unclustered,
        paint: {
          "circle-radius": 18,
          "circle-opacity": 0,
        },
      });
    }
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
  map.on("click", POI_CLUSTER_LAYER_ID, (event) => {
    const feature = event.features?.[0];
    const clusterId = feature?.properties?.cluster_id;
    const source = map.getSource(POI_SOURCE_ID) as GeoJSONSource | undefined;
    if (typeof clusterId !== "number" || !source?.getClusterExpansionZoom) return;
    void source.getClusterExpansionZoom(clusterId).then((zoom) => {
      if (!feature?.geometry || feature.geometry.type !== "Point") return;
      map.easeTo({
        center: feature.geometry.coordinates as [number, number],
        zoom,
      });
    });
  });
  map.on("mouseenter", POI_CLUSTER_LAYER_ID, () => {
    map.getCanvas().style.cursor = "pointer";
  });
  map.on("mouseleave", POI_CLUSTER_LAYER_ID, () => {
    map.getCanvas().style.cursor = "";
  });
}
