import type {
  ExpressionSpecification,
  GeoJSONSource,
  Map as MapLibreMap,
  MapLayerMouseEvent,
} from "maplibre-gl";
import {
  CCTV_ICON_ID,
  CCTV_ICON_OFF_ID,
  CCTV_LAYER_HIT_ID,
  CCTV_LAYER_ID,
  CCTV_SOURCE_ID,
} from "@/lib/cctv-constants";
import { isUnavailable } from "@/services/cctv-availability";
import type { CctvCamera } from "@/types/domain";

function toCollection(cameras: CctvCamera[]) {
  return {
    type: "FeatureCollection" as const,
    features: cameras.map((camera) => ({
      type: "Feature" as const,
      properties: {
        id: camera.id,
        priority: camera.withinLocateRadius ? 1 : 0,
        unavailable: isUnavailable(camera.status) ? 1 : 0,
      },
      geometry: {
        type: "Point" as const,
        coordinates: [camera.location.lng, camera.location.lat],
      },
    })),
  };
}

function drawCameraIcon(fill: string, lens: string): ImageData {
  const size = 64;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return new ImageData(size, size);
  }

  ctx.beginPath();
  ctx.arc(32, 32, 28, 0, Math.PI * 2);
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.lineWidth = 4;
  ctx.strokeStyle = "rgba(255,255,255,0.32)";
  ctx.stroke();

  ctx.fillStyle = "#f5f3ff";
  ctx.beginPath();
  ctx.roundRect(15, 24, 26, 18, 3);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(41, 28);
  ctx.lineTo(50, 23);
  ctx.lineTo(50, 43);
  ctx.lineTo(41, 38);
  ctx.closePath();
  ctx.fill();

  ctx.beginPath();
  ctx.arc(28, 33, 5.5, 0, Math.PI * 2);
  ctx.fillStyle = lens;
  ctx.fill();
  return ctx.getImageData(0, 0, size, size);
}

function ensureCctvIcons(map: MapLibreMap) {
  if (!map.hasImage(CCTV_ICON_ID)) {
    map.addImage(CCTV_ICON_ID, drawCameraIcon("#a855f7", "#3b0764"));
  }
  if (!map.hasImage(CCTV_ICON_OFF_ID)) {
    map.addImage(CCTV_ICON_OFF_ID, drawCameraIcon("#6b5284", "#2e1065"));
  }
}

function iconSizeExpression(selectedId: string | null): ExpressionSpecification {
  return [
    "case",
    ["==", ["get", "id"], selectedId ?? ""],
    0.58,
    ["==", ["get", "priority"], 1],
    0.48,
    0.4,
  ];
}

function iconImageExpression(): ExpressionSpecification {
  return [
    "case",
    ["==", ["get", "unavailable"], 1],
    CCTV_ICON_OFF_ID,
    CCTV_ICON_ID,
  ];
}

export function upsertCctvLayer(
  map: MapLibreMap,
  cameras: CctvCamera[],
  selectedId: string | null,
  visible = true,
) {
  ensureCctvIcons(map);
  const data = toCollection(cameras);

  const source = map.getSource(CCTV_SOURCE_ID);
  if (source?.type === "geojson") {
    (source as GeoJSONSource).setData(data);
  } else if (!source) {
    map.addSource(CCTV_SOURCE_ID, { type: "geojson", data });
  }

  const beforeId = map.getLayer("demo-route-glow")
    ? "demo-route-glow"
    : undefined;

  if (!map.getLayer(CCTV_LAYER_HIT_ID)) {
    map.addLayer(
      {
        id: CCTV_LAYER_HIT_ID,
        type: "circle",
        source: CCTV_SOURCE_ID,
        paint: {
          "circle-radius": 18,
          "circle-color": "#c084fc",
          "circle-opacity": 0,
        },
      },
      beforeId,
    );
  }

  if (!map.getLayer(CCTV_LAYER_ID)) {
    map.addLayer(
      {
        id: CCTV_LAYER_ID,
        type: "symbol",
        source: CCTV_SOURCE_ID,
        layout: {
          "icon-image": iconImageExpression(),
          "icon-size": iconSizeExpression(selectedId),
          "icon-allow-overlap": true,
          "icon-ignore-placement": true,
        },
        paint: {
          "icon-opacity": [
            "case",
            ["==", ["get", "unavailable"], 1],
            0.42,
            1,
          ],
        },
      },
      beforeId,
    );
  } else {
    map.setLayoutProperty(
      CCTV_LAYER_ID,
      "icon-size",
      iconSizeExpression(selectedId),
    );
  }
  const visibility = visible ? "visible" : "none";
  if (map.getLayer(CCTV_LAYER_ID)) {
    map.setLayoutProperty(CCTV_LAYER_ID, "visibility", visibility);
  }
  if (map.getLayer(CCTV_LAYER_HIT_ID)) {
    map.setLayoutProperty(CCTV_LAYER_HIT_ID, "visibility", visibility);
  }
}

const boundCctv = new WeakSet<MapLibreMap>();

export function bindCctvLayerClicks(
  map: MapLibreMap,
  onSelect: (cameraId: string) => void,
) {
  if (boundCctv.has(map)) return;
  boundCctv.add(map);
  const handle = (event: MapLayerMouseEvent) => {
    const feature = event.features?.[0];
    const id = feature?.properties?.id;
    if (typeof id === "string") onSelect(id);
  };

  map.on("click", CCTV_LAYER_ID, handle);
  map.on("click", CCTV_LAYER_HIT_ID, handle);
  map.on("mouseenter", CCTV_LAYER_HIT_ID, () => {
    map.getCanvas().style.cursor = "pointer";
  });
  map.on("mouseleave", CCTV_LAYER_HIT_ID, () => {
    map.getCanvas().style.cursor = "";
  });
}
