import type {
  ExpressionSpecification,
  GeoJSONSource,
  Map as MapLibreMap,
  MapLayerMouseEvent,
} from "maplibre-gl";
import type { RoadworkEvent } from "@/lib/roadwork/public";

export const ROADWORK_SOURCE_ID = "roadwork-source";
export const ROADWORK_LINE_LAYER_ID = "roadwork-line";
export const ROADWORK_POINT_LAYER_ID = "roadwork-point";
export const ROADWORK_HIT_LAYER_ID = "roadwork-hit";
export const ROADWORK_LAYER_LABEL = "道路施工";

const VERIFIED_COLOR = "#93c5fd";
const CLOSURE_COLOR = "#e2e8f0";

function data(events: RoadworkEvent[]) {
  return {
    type: "FeatureCollection" as const,
    features: events
      .filter(
        (event): event is RoadworkEvent & { geometry: NonNullable<RoadworkEvent["geometry"]> } =>
          event.map_visible && event.geometry != null && event.geometry_confidence === "verified",
      )
      .map((event) => ({
        type: "Feature" as const,
        id: event.id,
        properties: {
          id: event.id,
          displayClass: event.display_class,
          title: event.road_name ?? "已確認施工",
        },
        geometry: event.geometry,
      })),
  };
}

export function upsertRoadworkLayer(
  map: MapLibreMap,
  events: RoadworkEvent[],
  selectedId: string | null,
) {
  const collection = data(events);
  const source = map.getSource(ROADWORK_SOURCE_ID);
  if (source?.type === "geojson") (source as GeoJSONSource).setData(collection);
  else if (!source) map.addSource(ROADWORK_SOURCE_ID, { type: "geojson", data: collection });

  const color: ExpressionSpecification = [
    "match",
    ["get", "displayClass"],
    "closure_verified",
    CLOSURE_COLOR,
    VERIFIED_COLOR,
  ];

  if (!map.getLayer(ROADWORK_LINE_LAYER_ID)) {
    map.addLayer({
      id: ROADWORK_LINE_LAYER_ID,
      type: "line",
      source: ROADWORK_SOURCE_ID,
      filter: ["==", ["geometry-type"], "LineString"],
      paint: {
        "line-color": color,
        "line-width": 4,
        "line-dasharray": [
          "case",
          ["==", ["get", "displayClass"], "closure_verified"],
          ["literal", [1.2, 1.2]],
          ["literal", [1, 0]],
        ],
      },
      layout: { "line-cap": "round" },
    });
  }

  if (!map.getLayer(ROADWORK_POINT_LAYER_ID)) {
    map.addLayer({
      id: ROADWORK_POINT_LAYER_ID,
      type: "circle",
      source: ROADWORK_SOURCE_ID,
      filter: ["==", ["geometry-type"], "Point"],
      paint: {
        "circle-radius": ["interpolate", ["linear"], ["zoom"], 10, 5, 16, 9],
        "circle-color": color,
        "circle-stroke-color": "#dbeafe",
        "circle-stroke-width": ["case", ["==", ["get", "id"], selectedId ?? ""], 3, 1.5],
        "circle-opacity": 0.95,
      },
    });
  } else {
    map.setPaintProperty(
      ROADWORK_POINT_LAYER_ID,
      "circle-stroke-width",
      ["case", ["==", ["get", "id"], selectedId ?? ""], 3, 1.5],
    );
  }

  if (!map.getLayer(ROADWORK_HIT_LAYER_ID)) {
    map.addLayer({
      id: ROADWORK_HIT_LAYER_ID,
      type: "circle",
      source: ROADWORK_SOURCE_ID,
      filter: ["==", ["geometry-type"], "Point"],
      paint: { "circle-radius": 18, "circle-opacity": 0 },
    });
  }
}

const bound = new WeakSet<MapLibreMap>();

export function bindRoadworkLayerClicks(map: MapLibreMap, select: (id: string) => void) {
  if (bound.has(map)) return;
  bound.add(map);
  map.on("mouseenter", ROADWORK_HIT_LAYER_ID, () => {
    map.getCanvas().style.cursor = "pointer";
  });
  map.on("mouseleave", ROADWORK_HIT_LAYER_ID, () => {
    map.getCanvas().style.cursor = "";
  });
  map.on("click", ROADWORK_HIT_LAYER_ID, (event: MapLayerMouseEvent) => {
    const id = event.features?.[0]?.properties?.id;
    if (typeof id === "string") select(id);
  });
}
