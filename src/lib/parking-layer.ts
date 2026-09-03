import type {
  ExpressionSpecification,
  GeoJSONSource,
  Map as MapLibreMap,
  MapLayerMouseEvent,
} from "maplibre-gl";
import type { ParkingLot } from "@/types/domain";

export const PARKING_SOURCE_ID = "parking-source";
export const PARKING_CLUSTER_LAYER_ID = "parking-cluster-layer";
export const PARKING_CLUSTER_COUNT_LAYER_ID = "parking-cluster-count-layer";
export const PARKING_LAYER_ID = "parking-layer";
export const PARKING_LABEL_LAYER_ID = "parking-layer-label";
export const PARKING_HIT_LAYER_ID = "parking-hit-layer";

const FILL_COLOR: ExpressionSpecification = [
  "match",
  ["get", "fill"],
  "plenty",
  "#22c55e",
  "limited",
  "#eab308",
  "full",
  "#ef4444",
  "#71717a",
];

function data(lots: ParkingLot[]) {
  return {
    type: "FeatureCollection" as const,
    features: lots.map((lot) => ({
      type: "Feature" as const,
      id: lot.id,
      properties: {
        id: lot.id,
        fill: lot.fill,
        label:
          lot.carAvailable == null ? "?" : String(Math.max(0, lot.carAvailable)),
        selected: 0,
      },
      geometry: {
        type: "Point" as const,
        coordinates: [lot.location.lng, lot.location.lat],
      },
    })),
  };
}

export function upsertParkingLayer(
  map: MapLibreMap,
  lots: ParkingLot[],
  selectedId: string | null,
  visible = true,
) {
  const collection = data(lots);
  const source = map.getSource(PARKING_SOURCE_ID);
  if (source?.type === "geojson") {
    (source as GeoJSONSource).setData(collection);
  } else if (!source) {
    map.addSource(PARKING_SOURCE_ID, {
      type: "geojson",
      data: collection,
      cluster: true,
      clusterMaxZoom: 15,
      clusterRadius: 56,
    });
  }

  if (!map.getLayer(PARKING_CLUSTER_LAYER_ID)) {
    map.addLayer({
      id: PARKING_CLUSTER_LAYER_ID,
      type: "circle",
      source: PARKING_SOURCE_ID,
      filter: ["has", "point_count"],
      paint: {
        "circle-color": "#0f766e",
        "circle-radius": ["step", ["get", "point_count"], 16, 8, 20, 20, 24],
        "circle-stroke-color": "#ecfdf5",
        "circle-stroke-width": 1.4,
      },
    });
  }
  if (!map.getLayer(PARKING_CLUSTER_COUNT_LAYER_ID)) {
    map.addLayer({
      id: PARKING_CLUSTER_COUNT_LAYER_ID,
      type: "symbol",
      source: PARKING_SOURCE_ID,
      filter: ["has", "point_count"],
      layout: {
        "text-field": ["get", "point_count_abbreviated"],
        "text-size": 12,
      },
      paint: { "text-color": "#ecfdf5" },
    });
  }
  if (!map.getLayer(PARKING_HIT_LAYER_ID)) {
    map.addLayer({
      id: PARKING_HIT_LAYER_ID,
      type: "circle",
      source: PARKING_SOURCE_ID,
      filter: ["!", ["has", "point_count"]],
      paint: { "circle-radius": 22, "circle-opacity": 0 },
    });
  }
  if (!map.getLayer(PARKING_LAYER_ID)) {
    map.addLayer({
      id: PARKING_LAYER_ID,
      type: "circle",
      source: PARKING_SOURCE_ID,
      filter: ["!", ["has", "point_count"]],
      paint: {
        "circle-radius": [
          "case",
          ["==", ["get", "id"], selectedId ?? ""],
          16,
          13,
        ],
        "circle-color": FILL_COLOR,
        "circle-stroke-color": "#ecfdf5",
        "circle-stroke-width": [
          "case",
          ["==", ["get", "id"], selectedId ?? ""],
          3,
          1.4,
        ],
      },
    });
    map.addLayer({
      id: PARKING_LABEL_LAYER_ID,
      type: "symbol",
      source: PARKING_SOURCE_ID,
      filter: ["!", ["has", "point_count"]],
      layout: {
        "text-field": ["concat", "P", ["get", "label"]],
        "text-size": 10,
        "text-allow-overlap": true,
      },
      paint: { "text-color": "#052e16" },
    });
  } else {
    map.setPaintProperty(PARKING_LAYER_ID, "circle-radius", [
      "case",
      ["==", ["get", "id"], selectedId ?? ""],
      16,
      13,
    ]);
    map.setPaintProperty(PARKING_LAYER_ID, "circle-stroke-width", [
      "case",
      ["==", ["get", "id"], selectedId ?? ""],
      3,
      1.4,
    ]);
  }

  const visibility = visible ? "visible" : "none";
  for (const id of [
    PARKING_CLUSTER_LAYER_ID,
    PARKING_CLUSTER_COUNT_LAYER_ID,
    PARKING_LAYER_ID,
    PARKING_LABEL_LAYER_ID,
    PARKING_HIT_LAYER_ID,
  ]) {
    if (map.getLayer(id)) map.setLayoutProperty(id, "visibility", visibility);
  }
}

const bound = new WeakSet<MapLibreMap>();
export function bindParkingLayerClicks(
  map: MapLibreMap,
  select: (id: string) => void,
) {
  if (bound.has(map)) return;
  bound.add(map);
  map.on("click", PARKING_CLUSTER_LAYER_ID, (event) => {
    const feature = event.features?.[0];
    const clusterId = feature?.properties?.cluster_id;
    const source = map.getSource(PARKING_SOURCE_ID);
    if (typeof clusterId !== "number" || source?.type !== "geojson") return;
    (source as GeoJSONSource)
      .getClusterExpansionZoom(clusterId)
      .then((zoom) => {
        const coords = (
          feature?.geometry as { coordinates?: [number, number] } | undefined
        )?.coordinates;
        if (!coords) return;
        map.easeTo({ center: coords, zoom });
      })
      .catch(() => undefined);
  });
  const pick = (event: MapLayerMouseEvent) => {
    const id = event.features?.[0]?.properties?.id;
    if (typeof id === "string") select(id);
  };
  map.on("click", PARKING_LAYER_ID, pick);
  map.on("click", PARKING_HIT_LAYER_ID, pick);
  map.on("mouseenter", PARKING_LAYER_ID, () => {
    map.getCanvas().style.cursor = "pointer";
  });
  map.on("mouseleave", PARKING_LAYER_ID, () => {
    map.getCanvas().style.cursor = "";
  });
}
