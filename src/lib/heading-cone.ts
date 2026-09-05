import type { GeoJSONSource, Map as MapLibreMap } from "maplibre-gl";
import { destinationPoint } from "@/lib/geo";
import type { LngLat, VehiclePose } from "@/types/domain";

export const HEADING_CONE_SOURCE = "np-heading-cone";
export const HEADING_CONE_FILL = "np-heading-cone-fill";
export const HEADING_CONE_EDGE = "np-heading-cone-edge";

const HALF_ANGLE_DEG = 60;
const RADIUS_M = 92;
const ARC_STEPS = 22;

function firstLabelLayerId(map: MapLibreMap): string | undefined {
  const layers = map.getStyle()?.layers ?? [];
  return layers.find((layer) => layer.type === "symbol")?.id;
}

export function shouldShowHeadingCone({
  navigating,
  rerouting,
  source,
  headingAvailable,
}: {
  navigating: boolean;
  rerouting: boolean;
  source: VehiclePose["source"];
  headingAvailable?: boolean;
}) {
  return (
    !navigating &&
    !rerouting &&
    source === "gps" &&
    headingAvailable === true
  );
}

export function headingConePolygon(center: LngLat, headingDeg: number) {
  const start = headingDeg - HALF_ANGLE_DEG;
  const ring: [number, number][] = [[center.lng, center.lat]];
  for (let i = 0; i <= ARC_STEPS; i += 1) {
    const bearing = start + (i / ARC_STEPS) * HALF_ANGLE_DEG * 2;
    const tip = destinationPoint(center, RADIUS_M, bearing);
    ring.push([tip.lng, tip.lat]);
  }
  ring.push([center.lng, center.lat]);
  return {
    type: "Feature" as const,
    properties: {},
    geometry: {
      type: "Polygon" as const,
      coordinates: [ring],
    },
  };
}

export function ensureHeadingConeLayers(map: MapLibreMap): void {
  if (!map.getSource(HEADING_CONE_SOURCE)) {
    map.addSource(HEADING_CONE_SOURCE, {
      type: "geojson",
      data: { type: "FeatureCollection", features: [] },
    });
  }
  const beforeId = firstLabelLayerId(map);
  if (!map.getLayer(HEADING_CONE_FILL)) {
    map.addLayer(
      {
        id: HEADING_CONE_FILL,
        type: "fill",
        source: HEADING_CONE_SOURCE,
        paint: {
          "fill-color": "#3B82F6",
          "fill-opacity": 0.26,
          "fill-antialias": true,
        },
      },
      beforeId,
    );
  }
  if (!map.getLayer(HEADING_CONE_EDGE)) {
    map.addLayer(
      {
        id: HEADING_CONE_EDGE,
        type: "line",
        source: HEADING_CONE_SOURCE,
        paint: {
          "line-color": "#60A5FA",
          "line-width": 10,
          "line-opacity": 0.2,
          "line-blur": 7,
        },
      },
      beforeId,
    );
  }
}

export function upsertHeadingCone(
  map: MapLibreMap,
  center: LngLat | null,
  headingDeg: number,
  visible: boolean,
): void {
  const source = map.getSource(HEADING_CONE_SOURCE);
  if (!source || source.type !== "geojson") return;
  const geo = source as GeoJSONSource;
  if (!visible || !center) {
    geo.setData({ type: "FeatureCollection", features: [] });
    return;
  }
  geo.setData({
    type: "FeatureCollection",
    features: [headingConePolygon(center, headingDeg)],
  });
}
