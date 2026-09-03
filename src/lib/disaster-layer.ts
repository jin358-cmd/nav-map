import type { GeoJSONSource, Map as MapLibreMap, MapLayerMouseEvent } from "maplibre-gl";
import type { DisasterAlert } from "@/types/domain";

export const DISASTER_SOURCE_ID = "disaster-source";
export const DISASTER_LAYER_ID = "disaster-layer";
export const DISASTER_HIT_LAYER_ID = "disaster-hit-layer";

function data(alerts: DisasterAlert[]) {
  return {
    type: "FeatureCollection" as const,
    features: alerts.map((alert) => ({
      type: "Feature" as const,
      id: alert.id,
      properties: { id: alert.id, kind: alert.kind, severity: alert.severity, title: alert.title },
      geometry: { type: "Point" as const, coordinates: [alert.location.lng, alert.location.lat] },
    })),
  };
}

export function upsertDisasterLayer(
  map: MapLibreMap,
  alerts: DisasterAlert[],
  selectedId: string | null,
  visible = true,
) {
  const source = map.getSource(DISASTER_SOURCE_ID);
  if (source?.type === "geojson") (source as GeoJSONSource).setData(data(alerts));
  else if (!source) map.addSource(DISASTER_SOURCE_ID, { type: "geojson", data: data(alerts) });

  if (!map.getLayer(DISASTER_LAYER_ID)) {
    map.addLayer({
      id: DISASTER_LAYER_ID,
      type: "circle",
      source: DISASTER_SOURCE_ID,
      paint: {
        "circle-radius": ["interpolate", ["linear"], ["zoom"], 10, 6, 16, 11],
        "circle-color": ["match", ["get", "severity"], "emergency", "#dc2626", "warning", "#f97316", "#fbbf24"],
        "circle-stroke-color": "#fff7ed",
        "circle-stroke-width": ["case", ["==", ["get", "id"], selectedId ?? ""], 3, 1.5],
        "circle-opacity": 0.92,
      },
    });
  } else {
    map.setPaintProperty(DISASTER_LAYER_ID, "circle-stroke-width", ["case", ["==", ["get", "id"], selectedId ?? ""], 3, 1.5]);
  }
  if (!map.getLayer(DISASTER_HIT_LAYER_ID)) {
    map.addLayer({ id: DISASTER_HIT_LAYER_ID, type: "circle", source: DISASTER_SOURCE_ID, paint: { "circle-radius": 20, "circle-opacity": 0 } });
  }
  const visibility = visible ? "visible" : "none";
  if (map.getLayer(DISASTER_LAYER_ID)) {
    map.setLayoutProperty(DISASTER_LAYER_ID, "visibility", visibility);
  }
  if (map.getLayer(DISASTER_HIT_LAYER_ID)) {
    map.setLayoutProperty(DISASTER_HIT_LAYER_ID, "visibility", visibility);
  }
  for (const routeLayer of ["demo-route-glow", "demo-route-line"]) {
    if (map.getLayer(routeLayer)) map.moveLayer(routeLayer);
  }
}

const bound = new WeakSet<MapLibreMap>();
export function bindDisasterLayerClicks(map: MapLibreMap, select: (id: string) => void) {
  if (bound.has(map)) return;
  bound.add(map);
  map.on("mouseenter", DISASTER_HIT_LAYER_ID, () => { map.getCanvas().style.cursor = "pointer"; });
  map.on("mouseleave", DISASTER_HIT_LAYER_ID, () => { map.getCanvas().style.cursor = ""; });
  map.on("click", DISASTER_HIT_LAYER_ID, (event: MapLayerMouseEvent) => {
    const id = event.features?.[0]?.properties?.id;
    if (typeof id === "string") select(id);
  });
}
